import assert from "node:assert/strict";
import test from "node:test";

process.env.VITE_NETWORK_ID = "mainnet";

const { railDelivered } = await import("../src/lib/bridge/executeNear.ts");
const { setNodeUrlForReads } = await import("../src/lib/near/swapOutcome.ts");

// A swap into the bridge rail can pay out in either form, and the two are not
// distinguishable from the transaction. A `wrap.near` credit is a NEP-141 transfer and
// logs an `ft_transfer`. Native NEAR arrives by a plain transfer, and a plain transfer
// emits no event — so the logs are structurally blind to the native case, and a reader
// that only reads logs reports a swap that worked as having delivered nothing.

const WRAP = "wrap.near";
const NATIVE = "near";
const ACC = "marior.near";
const HASH = "DJmTV6S2qYTSVbNYrRAtiwqjCJwr89R9mB8yuBUQNxjB";

const originalFetch = globalThis.fetch;
setNodeUrlForReads("https://node.invalid");

/** The bytes a `call_function` query answers with. */
const b64 = (value: unknown) =>
  JSON.stringify(value)
    .split("")
    .map((c) => c.charCodeAt(0));

/**
 * A node that serves the transaction and both balances, so the two readings can be
 * told apart.
 */
function node({
  logs = [] as string[],
  reverted = false,
  wrapped = 0n,
  native = 0n,
}: {
  logs?: string[];
  reverted?: boolean;
  wrapped?: bigint;
  native?: bigint;
}) {
  globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    const params = body.params ?? {};

    if (body.method === "tx") {
      const status = reverted
        ? {
            Failure: {
              ActionError: {
                index: 0,
                kind: {
                  FunctionCallError: {
                    ExecutionError:
                      "Smart contract panicked: The account doesn't have enough balance",
                  },
                },
              },
            },
          }
        : { SuccessValue: "" };
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "dontcare",
          result: { status, receipts_outcome: [{ outcome: { logs, status } }] },
        }),
        { status: 200 },
      );
    }

    if (params.request_type === "view_account") {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "dontcare",
          result: { amount: native.toString() },
        }),
        { status: 200 },
      );
    }

    // ft_balance_of
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: "dontcare",
        result: { result: b64(wrapped.toString()) },
      }),
      { status: 200 },
    );
  }) as typeof fetch;
}

const leg = (over: {
  before: { wrapped: bigint; native: bigint };
  spentToken: string;
}) => ({
  floor: 0n,
  txHash: HASH,
  accountId: ACC,
  railToken: WRAP,
  forAmount: 100n,
  ...over,
});

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("a native payout is found, even though the logs are empty", async () => {
  // Exactly the reported case: the swap worked, paid out native NEAR, and left no
  // event behind. The wrapped balance is untouched at 5, so a reader sampling only the
  // rail's contract sees no change at all.
  node({ logs: [], wrapped: 5n, native: 1_000n });
  const result = await railDelivered(
    leg({ before: { wrapped: 5n, native: 0n } }),
  );

  assert.equal(result.produced, 1_000n, "what arrived is what is bridged");
  assert.ok(
    result.wrap,
    "native NEAR has to be wrapped before the bridge takes it",
  );
  assert.equal(
    result.wrap?.actions[0]?.functionCall?.methodName,
    "ft_on_transfer",
  );
});

test("a wrapped payout is taken from the logs, and needs no wrapping", async () => {
  node({
    logs: [
      JSON.stringify({
        event_type: "ft_transfer",
        token_id: WRAP,
        new_owner_id: ACC,
        amount: "2500000000000000000000000",
      }),
    ],
    wrapped: 3_000n,
    native: 0n,
  });
  const result = await railDelivered(
    leg({ before: { wrapped: 1_000n, native: 0n } }),
  );

  assert.equal(result.produced, 2_500_000_000_000_000_000_000_000n);
  assert.equal(result.wrap, null, "already wrapped, so nothing to do");
});

test("a reverted swap says why, and does not fall through to the balances", async () => {
  // A panicking call emits no events, so a failed swap's log list is empty. Falling
  // through to the balances would report a *failed* swap as one that delivered
  // nothing, which is a completely different thing to ask a user to do about it.
  node({
    logs: [],
    reverted: true,
    wrapped: 5n,
    native: 999n,
  });
  await assert.rejects(
    () => railDelivered(leg({ before: { wrapped: 5n, native: 0n } })),
    (err: Error) => {
      assert.match(err.message, /did not go through/);
      assert.match(
        err.message,
        /doesn't have enough balance/,
        "the chain's own reason is passed through",
      );
      return true;
    },
  );
});

test("a balance the swap also spent is not read as what arrived", async () => {
  // Swapping 10 wNEAR out and being paid 20 back: the balance moved by +10, and
  // calling that "20 arrived" would bridge the wrong amount. The log above is the
  // reading that is exact, because it is attributed to this transaction.
  node({
    logs: [
      JSON.stringify({
        event_type: "ft_transfer",
        token_id: WRAP,
        new_owner_id: ACC,
        amount: "20",
      }),
    ],
    wrapped: 110n,
    native: 0n,
  });
  const result = await railDelivered(
    leg({ before: { wrapped: 100n, native: 0n }, spentToken: WRAP }),
  );
  assert.equal(result.produced, 20n, "the log, not the net +10");
});

test("native NEAR spent by the swap is not read as what arrived", async () => {
  node({ logs: [], wrapped: 2_000n, native: 90n });
  const result = await railDelivered(
    leg({ before: { wrapped: 0n, native: 100n }, spentToken: NATIVE }),
  );
  assert.equal(result.produced, 2_000n, "the wrapped gain, which is clean");
  assert.equal(result.wrap, null);
});

test("when nothing arrived, the error names both forms", async () => {
  // Naming only the wrapped contract is wrong whenever the payout would have been
  // native — which is precisely the case that reaches this message.
  node({ logs: [], wrapped: 5n, native: 0n });
  await assert.rejects(
    () => railDelivered(leg({ before: { wrapped: 5n, native: 0n } })),
    (err: Error) => {
      assert.match(err.message, new RegExp(WRAP.replace(".", "\\.")));
      assert.match(err.message, /native NEAR/);
      return true;
    },
  );
});

test("an unreadable transaction still gets answered by the balances", async () => {
  // A node that cannot serve the transaction must not end this: the balances answer
  // the same question, and for a native payout they are the only reading there is.
  globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    const params = body.params ?? {};
    if (body.method === "tx") throw new Error("tx unavailable");
    if (params.request_type === "view_account") {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "dontcare",
          result: { amount: "400" },
        }),
        { status: 200 },
      );
    }
    // The wrapped balance is unchanged: a native payout does not touch it, which is
    // why the wrapped gain must not be what gets read here.
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: "dontcare",
        result: { result: b64("5") },
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  const result = await railDelivered(
    leg({ before: { wrapped: 5n, native: 0n } }),
  );
  assert.equal(result.produced, 400n);
  assert.ok(result.wrap);
});
