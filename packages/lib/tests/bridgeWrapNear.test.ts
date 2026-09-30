import assert from "node:assert/strict";
import test from "node:test";

process.env.VITE_NETWORK_ID = "mainnet";

const { wrapNearDeficit } = await import("../src/bridge/executeNear.ts");
const { setNodeUrlForReads } = await import("../src/near/swapOutcome.ts");

// Native NEAR is not wNEAR. The bridge's deposit is an `ft_transfer_call` on the
// wrapping contract, so it debits the *wrapped* balance — while the money the form
// measured is the native one. This is the one place that reconciles the two: what is
// already wrapped is used, and only the difference is wrapped.
//
// The reported bug was the opposite: a direct native-NEAR bridge signed the deposit
// with nothing wrapped at all, so it failed on an account holding the entire amount
// natively.

const WRAP = "wrap.near";
const ACC = "marior.near";
const HASH = "DJmTV6S2qYTSVbNYrRAtiwqjCJwr89R9mB8yuBUQNxjB";
const SOL_MINT = "So11111111111111111111111111111111111111112";
/** One whole NEAR in yoctoNEAR — the rail's 24 decimals. */
const ONE_NEAR = 10n ** 24n;
/** 0.4 NEAR already wrapped, so 0.6 is the deficit. */
const PARTIAL = (ONE_NEAR * 2n) / 5n;
/** `storage_balance_bounds.min` on mainnet, read from wrap.near itself. */
const MIN = 1_250_000_000_000_000_000_000n;

const originalFetch = globalThis.fetch;
setNodeUrlForReads("https://node.invalid");

/** The bytes a `call_function` query answers with. */
const b64 = (value: unknown) =>
  JSON.stringify(value)
    .split("")
    .map((c) => c.charCodeAt(0));

/** A node that serves the wrapped balance and the storage questions. */
function node({
  wrapped = 0n,
  registered = true,
  min = MIN,
  onCall,
}: {
  wrapped?: bigint;
  registered?: boolean;
  min?: bigint;
  onCall?: (method: string) => void;
} = {}) {
  globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    const method: string = body?.params?.method_name ?? "";
    onCall?.(method);
    // `storage_balance_of` answers null for an account that never registered, which
    // is an answer rather than a failure — and the one the wrap decision turns on.
    const answer =
      method === "ft_balance_of"
        ? wrapped.toString()
        : method === "storage_balance_of"
          ? registered
            ? { total: MIN.toString(), available: MIN.toString() }
            : null
          : method === "storage_balance_bounds"
            ? { min: min.toString(), max: min.toString() }
            : (() => {
                throw new Error(`unexpected read: ${method}`);
              })();
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: "dontcare",
        result: { result: b64(answer) },
      }),
      { status: 200 },
    );
  }) as typeof fetch;
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("the already-wrapped balance covers it, so nothing is wrapped", async () => {
  node({ wrapped: 2_000n, registered: true });
  assert.deepEqual(await wrapNearDeficit(WRAP, ACC, 1_000n), []);
});

test("only the missing part is wrapped", async () => {
  node({ wrapped: 400n, registered: true });
  const [tx] = await wrapNearDeficit(WRAP, ACC, 1_000n);
  assert.equal(tx?.receiverId, WRAP);
  assert.equal(tx?.actions[0]?.functionCall?.methodName, "near_deposit");
  assert.equal(
    tx?.actions[0]?.functionCall?.deposit,
    600n,
    "1,000 less the 400 already in the account",
  );
  // The existing wrapped balance is spent rather than duplicated, so an account that
  // is already registered needs nothing else.
  assert.equal(tx?.actions.length, 1);
});

test("a first wrap registers the account, then wraps the whole amount", async () => {
  const calls: string[] = [];
  node({ wrapped: 0n, registered: false, onCall: (m) => calls.push(m) });
  const txs = await wrapNearDeficit(WRAP, ACC, 1_000n);

  assert.deepEqual(
    calls.sort(),
    ["ft_balance_of", "storage_balance_bounds", "storage_balance_of"],
    "the min is read from the contract rather than assumed",
  );
  assert.equal(txs.length, 2);
  assert.equal(txs[0]?.actions[0]?.functionCall?.methodName, "storage_deposit");
  assert.equal(txs[0]?.actions[0]?.functionCall?.deposit, MIN);
  assert.equal(txs[1]?.actions[0]?.functionCall?.methodName, "near_deposit");
  assert.equal(txs[1]?.actions[0]?.functionCall?.deposit, 1_000n);
});

test("a registered account needs no storage deposit even with no balance", async () => {
  node({ wrapped: 0n, registered: true });
  const txs = await wrapNearDeficit(WRAP, ACC, 1_000n);
  assert.equal(txs.length, 1);
  assert.equal(txs[0]?.actions[0]?.functionCall?.methodName, "near_deposit");
  assert.equal(txs[0]?.actions[0]?.functionCall?.deposit, 1_000n);
});

test("the registration precedes the deposit that credits the account", async () => {
  // Order is the point: the storage deposit has to settle before `near_deposit` can
  // credit the wrapped balance the locker call later debits.
  node({ wrapped: 250n, registered: false });
  const txs = await wrapNearDeficit(WRAP, ACC, 1_000n);
  assert.deepEqual(
    txs.map((tx) => tx.actions[0]?.functionCall?.methodName),
    ["storage_deposit", "near_deposit"],
  );
  assert.equal(txs[1]?.actions[0]?.functionCall?.deposit, 750n);
});

test("nothing to wrap never asks the node", async () => {
  let calls = 0;
  node({ onCall: () => (calls += 1) });
  assert.deepEqual(await wrapNearDeficit(WRAP, ACC, 0n), []);
  assert.equal(calls, 0, "a zero amount is not a question");
});

// --- the batch that actually reaches the wallet -----------------------------------
//
// `wrapNearDeficit`'s return value is not what signs: the executor hands its
// transactions to the Omni SDK, which builds the deposit around them. So the whole
// path is run — real executor, real SDK, real transaction assembly — against a stub
// node, the bridge's fee API, and a wallet that records what it was asked to sign.

type CapturedTransaction = {
  receiverId?: string;
  actions: {
    functionCall?: { methodName?: string; deposit?: bigint; args?: Uint8Array };
  }[];
};

/**
 * The router's answer for a swap quoted from the wrapping contract.
 *
 * Deliberately a route that spends wNEAR with no `near_deposit` of its own — which is
 * what the router builds for `token_in=wrap.near`, and the reason the executor has to
 * wrap the input itself.
 */
const wrapRoute = {
  dex_id: "Rhea",
  estimated_amount: { amount_out: "900000000000000000" },
  worst_case_amount: { amount_out: "890000000000000000" },
  token_output: "token.0xshitzu.near",
  execution_instructions: [
    {
      NearTransaction: {
        receiver_id: WRAP,
        actions: [
          {
            FunctionCall: {
              method_name: "ft_transfer_call",
              args: btoa(
                JSON.stringify({
                  receiver_id: "v2.ref-finance.near",
                  amount: ONE_NEAR.toString(),
                  msg: "{}",
                }),
              ),
              gas: "100000000000000",
              deposit: "1",
            },
          },
        ],
      },
    },
  ],
};

/** A node and fee API that answer every read the deposit makes, and a wallet that
 *  records the batch. `storage_balance_of` answers for the user according to
 *  `registered`, and for the locker with a real balance, which is what the SDK asks
 *  about on its own account. */
function depositHarness({
  wrapped = 0n,
  registered = false,
}: { wrapped?: bigint; registered?: boolean } = {}) {
  const sent: CapturedTransaction[] = [];
  const fee = {
    native_token_fee: "0",
    gas_fee: null,
    protocol_fee: null,
    relayer_fee: null,
    usd_fee: 0,
    transferred_token_fee: "0",
    insufficient_utxo: false,
  };
  const wallet = {
    getAccounts: async () => [{ accountId: ACC }],
    signAndSendTransactions: async ({
      transactions,
    }: {
      transactions: CapturedTransaction[];
    }) => {
      sent.push(...transactions);
      return [
        {
          transaction: { hash: HASH },
          receipts_outcome: [
            {
              outcome: {
                logs: [
                  JSON.stringify({
                    InitTransferEvent: {
                      transfer_message: { origin_nonce: 7 },
                    },
                  }),
                ],
              },
            },
          ],
        },
      ];
    },
  };

  globalThis.fetch = (async (url: unknown, init?: { body?: string }) => {
    const target = String(url);
    if (target.includes("bridge.nearone.org")) {
      return new Response(JSON.stringify(fee), { status: 200 });
    }
    // The router, for the two swap paths. Its own answer has no `near_deposit` in
    // it, which is what makes the executor's wrap necessary.
    if (target.includes("router.intear.tech")) {
      return new Response(JSON.stringify([wrapRoute]), { status: 200 });
    }
    const body = JSON.parse(String(init?.body ?? "{}"));
    const params = body?.params ?? {};
    // A transaction read, for `deliveredBySwap` after a swap: no logs, which is a
    // real answer (the guaranteed floor is used) rather than a failed read that would
    // be retried against the node.
    if (body.method === "tx") {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "1",
          result: {
            transaction_outcome: { outcome: { logs: [] } },
            receipts_outcome: [],
          },
        }),
        { status: 200 },
      );
    }
    if (params.request_type === "view_account") {
      return new Response(
        JSON.stringify({ jsonrpc: "2.0", id: "1", result: { amount: "1" } }),
        { status: 200 },
      );
    }
    const args: { account_id?: string } = params.args_base64
      ? JSON.parse(atob(params.args_base64))
      : {};
    const method: string = params.method_name ?? "";
    const answer =
      method === "ft_balance_of"
        ? wrapped.toString()
        : method === "storage_balance_of"
          ? args.account_id === ACC
            ? registered
              ? { total: MIN.toString(), available: MIN.toString() }
              : null
            : { total: MIN.toString(), available: MIN.toString() }
          : method === "storage_balance_bounds"
            ? { min: MIN.toString(), max: MIN.toString() }
            : method.startsWith("required_balance_for")
              ? "0"
              : (() => {
                  throw new Error(
                    `unexpected read: ${params.account_id}::${method}`,
                  );
                })();
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: "1",
        result: { result: b64(answer) },
      }),
      { status: 200 },
    );
  }) as typeof fetch;

  return { sent, selector: { wallet: async () => wallet } };
}

/** One whole NEAR, in the rail's own units, bridged straight to Solana. */
const directPlan = {
  kind: "bridge",
  rail: {
    tokenId: "NEAR",
    symbol: "NEAR",
    icon: "",
    sourceAddress: WRAP,
    destAddress: SOL_MINT,
    sourceDecimals: 24,
    destDecimals: 9,
  },
  sourceSymbol: "NEAR",
  targetSymbol: "SOL",
  targetDecimals: 9,
  sourceSwap: null,
  targetSwap: null,
  bridgedAmount: ONE_NEAR,
  tokenFee: 0n,
  nativeFee: 0n,
  usdFee: null,
  arrivedAmount: 1_000_000_000n,
  receiveAmount: 1_000_000_000n,
  receiveEstimated: 1_000_000_000n,
};

async function directBridge(selector: { wallet: unknown }) {
  const { runFromNear } = await import("../src/bridge/executeNear.ts");
  return runFromNear({
    plan: directPlan as never,
    amount: ONE_NEAR,
    sourceTokenId: WRAP,
    to: "solana",
    recipient: SOL_MINT,
    accountId: ACC,
    selector: selector as never,
  });
}

test("a first native-NEAR bridge registers, wraps, then deposits", async () => {
  const harness = depositHarness({ wrapped: 0n, registered: false });
  const result = await directBridge(harness.selector);

  assert.equal(result.bridged, ONE_NEAR);
  // Register first, wrap the whole amount, and only then hand it to the locker — in
  // that order, in one signed batch.
  assert.deepEqual(
    harness.sent.map((tx) => tx.actions[0]?.functionCall?.methodName),
    ["storage_deposit", "near_deposit", "ft_transfer_call"],
  );
  assert.equal(harness.sent[1]?.actions[0]?.functionCall?.deposit, ONE_NEAR);
  assert.equal(harness.sent[2]?.receiverId, WRAP);
});

test("a native-NEAR bridge with wNEAR already held wraps only the difference", async () => {
  const harness = depositHarness({ wrapped: PARTIAL, registered: true });
  const result = await directBridge(harness.selector);

  assert.equal(result.bridged, ONE_NEAR);
  assert.deepEqual(
    harness.sent.map((tx) => tx.actions[0]?.functionCall?.methodName),
    ["near_deposit", "ft_transfer_call"],
    "the existing wrapped balance is spent and only the difference is wrapped",
  );
  assert.equal(
    harness.sent[0]?.actions[0]?.functionCall?.deposit,
    ONE_NEAR - PARTIAL,
  );
});

// --- the swap paths, which ask the router for wNEAR -------------------------------
//
// `token_in=wrap.near` returns a route that starts by spending the wrapped balance; the
// router was told the input *is* wNEAR, so it never adds a `near_deposit`. Both the
// same-chain swap on NEAR and a conversion's source swap go through that, and both
// were signing against a balance the account did not have.

test("a same-chain swap from native NEAR wraps before the router's transactions", async () => {
  const harness = depositHarness({ wrapped: 0n, registered: false });
  const { runNearDestinationSwap } = await import(
    "../src/bridge/executeNear.ts"
  );
  const result = await runNearDestinationSwap({
    railTokenId: WRAP,
    targetTokenId: "token.0xshitzu.near",
    amountIn: ONE_NEAR,
    accountId: ACC,
    selector: harness.selector as never,
  });

  assert.deepEqual(
    harness.sent.map((tx) => tx.actions[0]?.functionCall?.methodName),
    ["storage_deposit", "near_deposit", "ft_transfer_call"],
    "the wrap is signed in front of the route the router built",
  );
  assert.equal(harness.sent[1]?.actions[0]?.functionCall?.deposit, ONE_NEAR);
  assert.equal(result.received, 890_000_000_000_000_000n);
});

test("a source swap from native NEAR wraps before the swap", async () => {
  const harness = depositHarness({ wrapped: 0n, registered: false });
  const { runNearSourceSwap } = await import("../src/bridge/executeNear.ts");
  const leg = await runNearSourceSwap({
    plan: {
      ...directPlan,
      rail: {
        ...directPlan.rail,
        tokenId: "SHITZU",
        symbol: "SHITZU",
        sourceAddress: "token.0xshitzu.near",
        destAddress: "AFbJW5",
      },
    } as never,
    amount: ONE_NEAR,
    sourceTokenId: WRAP,
    accountId: ACC,
    selector: harness.selector as never,
  });

  assert.deepEqual(
    harness.sent.map((tx) => tx.actions[0]?.functionCall?.methodName),
    ["storage_deposit", "near_deposit", "ft_transfer_call"],
  );
  assert.equal(harness.sent[1]?.actions[0]?.functionCall?.deposit, ONE_NEAR);
  assert.equal(leg.railToken, "token.0xshitzu.near");
  assert.equal(leg.forAmount, ONE_NEAR);
});
