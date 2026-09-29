import assert from "node:assert/strict";
import test from "node:test";

process.env.VITE_NETWORK_ID = "mainnet";

const { runNearDestinationSwap } = await import("../src/bridge/executeNear.ts");

// A swap that was never signed must never be reported as a swap that happened.
//
// `runNearSourceSwap` has always checked whether the wallet actually signed.
// `runNearDestinationSwap` called the same function and discarded its return value, so
// a wallet that reported nothing — a blocked popup, a dismissed one, a browser
// refusing a prompt with no user gesture behind it — fell straight through and the
// transfer was reported complete. The receipt then quoted a "received" amount for a
// swap that was never signed.

const ACC = "marior.near";
const RAIL = "wrap.near";
const TARGET = "token.0xshitzu.near";

/** A router answer, and a wallet that signs nothing. */
function stub({ signs }: { signs: boolean }) {
  const originalFetch = globalThis.fetch;
  const route = {
    dex_id: "rhea",
    estimated_amount: { amount_out: "9000000000000000000000000" },
    worst_case_amount: { amount_out: "8800000000000000000000000" },
    in_amount: "1000000000000000000000000",
    swap_mode: "ExactIn",
    slippage_bps: 300,
    // A real route carries the instructions; `executableRoutes` drops anything that
    // cannot be expressed as NEAR transactions, so an empty array would leave nothing
    // to sign and the test would pass for the wrong reason.
    execution_instructions: [
      {
        NearTransaction: {
          signer_id: ACC,
          receiver_id: "swap.rhea.near",
          // `routeToNajTransactions` maps over the actions, so a route with none would
          // produce no transactions and the test would pass for the wrong reason.
          actions: [
            {
              FunctionCall: {
                method_name: "swap",
                // Base64 of `{"amount_in":"1"}`, which is what the router sends and
                // what `decodeArgs` expects — raw JSON throws on `atob`.
                args: "eyJhbW91bnRfaW4iOiIxIn0=",
                gas: "30000000000000",
                deposit: "1",
              },
            },
          ],
        },
      },
    ],
  };
  const originalSelector = { wallet: async () => null };
  const selector = {
    wallet: async () => ({
      // The wallet returns one outcome per transaction, and `runRouteTransactions`
      // reads the hash off the last one. Returning nothing is what a blocked or
      // dismissed popup looks like from here.
      signAndSendTransactions: async () =>
        signs ? [{ transaction: { hash: "SWAPHASH" } }] : undefined,
    }),
  };
  globalThis.fetch = (async (url: unknown) => {
    const body = String(url);
    if (body.includes("router.intear.tech")) {
      return new Response(JSON.stringify([route]), { status: 200 });
    }
    if (body.includes("transaction_hash")) {
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: "dontcare",
          result: { status: { SuccessValue: "" }, receipts_outcome: [] },
        }),
        { status: 200 },
      );
    }
    return new Response("[]", { status: 200 });
  }) as typeof fetch;
  return { originalFetch, selector, originalSelector };
}

test("a wallet that signs nothing is an error, not a completed swap", async () => {
  const { originalFetch, selector } = stub({ signs: false });
  try {
    await assert.rejects(
      runNearDestinationSwap({
        railTokenId: RAIL,
        targetTokenId: TARGET,
        amountIn: 1_000_000_000_000_000_000_000_000n,
        accountId: ACC,
        selector: selector as never,
      }),
      // The reason has to name what is true: the tokens arrived, the swap did not.
      /did not sign the swap/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("the reported amount is measured, never the router's estimate", async () => {
  // The receipt calls its figure "You received", so a forecast in that slot is a lie
  // told in a confident font. The estimate is deliberately *higher* than the floor the
  // swap was signed at, so a test that only checked "not zero" would pass either way.
  const { originalFetch, selector } = stub({ signs: true });
  try {
    const result = await runNearDestinationSwap({
      railTokenId: RAIL,
      targetTokenId: TARGET,
      amountIn: 1_000_000_000_000_000_000_000_000n,
      accountId: ACC,
      selector: selector as never,
    });
    assert.notEqual(
      result.received.toString(),
      "9000000000000000000000000",
      "not the estimate",
    );
    assert.equal(
      result.received,
      result.guaranteed,
      "and the floor the swap was signed at when the logs cannot be read",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
