import assert from "node:assert/strict";
import test from "node:test";

process.env.VITE_NETWORK_ID = "mainnet";

const {
  DESTINATION_QUOTE_ATTEMPTS,
  DESTINATION_QUOTE_BACKOFF_MS,
  quoteDestinationSwap,
  runSolanaDestinationSwap,
} = await import("../src/bridge/executeSolanaSwapLeg.ts");

// The bug this file exists for: the bridge finalised, the destination swap asked
// Jupiter once, got an empty answer, and told the user the route was "no longer
// available" — while the search on the very same pair retries a cold router as a
// matter of course. One empty answer is not a market verdict, and the call that
// lands the instant a bridge finalises is exactly the one that lands in a cold
// window.

const RAIL = "3ZLekZYq2qkZiSpnSvabjit34tUkjSwD1JFuW9as9wBG";
const TARGET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const ROUTE = JSON.stringify({
  inputMint: RAIL,
  inAmount: "1000000",
  outputMint: TARGET,
  outAmount: "2000000",
  otherAmountThreshold: "1900000",
  slippageBps: 100,
  priceImpactPct: "0",
  routePlan: [],
});

/**
 * A Jupiter that answers from a script, and counts the calls.
 *
 * `"none"` is Jupiter's own "no route for this pair": a 400 carrying an
 * `errorCode`, which `getQuote` turns into null. `"error"` is a transport
 * failure, which `getQuote` throws.
 */
function stubQuote(answers: ("route" | "none" | "error")[]) {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    const answer = answers[calls++] ?? "none";
    if (answer === "error") throw new Error("the network is down");
    if (answer === "route") return new Response(ROUTE, { status: 200 });
    return new Response(JSON.stringify({ errorCode: "TOKEN_NOT_TRADABLE" }), {
      status: 400,
    });
  }) as typeof fetch;
  return {
    calls: () => calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

test("an empty answer is asked again instead of being believed", async () => {
  const stub = stubQuote(["none", "route"]);
  try {
    const quote = await quoteDestinationSwap(RAIL, TARGET, 1_000_000n, {
      attempts: 3,
      backoffMs: [1, 1],
    });
    assert.ok(quote, "the second ask found the route");
    assert.equal(stub.calls(), 2, "and exactly two asks were made");
  } finally {
    stub.restore();
  }
});

test("every ask is exhausted before the leg reports no route", async () => {
  const stub = stubQuote(["none", "none", "none"]);
  try {
    const quote = await quoteDestinationSwap(RAIL, TARGET, 1_000_000n, {
      attempts: 3,
      backoffMs: [1, 1],
    });
    assert.equal(quote, null);
    assert.equal(stub.calls(), 3, "the whole budget was spent first");
  } finally {
    stub.restore();
  }
});

test("a network failure is retried, and a route that appears is used", async () => {
  // A transport error says nothing about whether the pair trades, so retrying it
  // is even more clearly right than retrying a 404.
  const stub = stubQuote(["error", "route"]);
  try {
    const quote = await quoteDestinationSwap(RAIL, TARGET, 1_000_000n, {
      attempts: 3,
      backoffMs: [1, 1],
    });
    assert.ok(quote);
    assert.equal(stub.calls(), 2);
  } finally {
    stub.restore();
  }
});

test("an error that outlives the budget is thrown as itself, not as no route", async () => {
  // "No route" is a claim about the market. A dead network never made it, and
  // reporting the two the same way sends the user looking for a liquidity
  // problem that does not exist.
  const stub = stubQuote(["error", "error"]);
  try {
    await assert.rejects(
      quoteDestinationSwap(RAIL, TARGET, 1_000_000n, {
        attempts: 2,
        backoffMs: [1],
      }),
      /the network is down/,
    );
  } finally {
    stub.restore();
  }
});

test("the retry budget is the execution budget, not the search's one attempt", () => {
  // Injected attempts make the tests above order-independent of the default, so
  // the default itself is pinned here. A leg with a signature behind it and the
  // user's money already across the bridge gets the full budget; the search's
  // single attempt is a decision about request volume on a debounce and does not
  // apply here.
  assert.equal(DESTINATION_QUOTE_ATTEMPTS, 5);
  assert.equal(
    DESTINATION_QUOTE_BACKOFF_MS.length,
    DESTINATION_QUOTE_ATTEMPTS - 1,
    "one wait between each pair of asks",
  );
});

test("the exhausted leg does not send the user hunting for the token list", async () => {
  const stub = stubQuote(["none", "none"]);
  try {
    await assert.rejects(
      runSolanaDestinationSwap({
        railMint: RAIL,
        targetMint: TARGET,
        amountIn: 1_000_000n,
        provider: {} as never,
        routing: { attempts: 2, backoffMs: [1] },
      }),
      (err: Error) => {
        assert.match(err.name, /TransferError/);
        assert.match(err.message, /No swap route/);
        // The recovery is a pair of buttons now, and a sentence pointing at a
        // "token list" the user has to find is how the old dead end looked.
        assert.doesNotMatch(err.message, /token list/);
        return true;
      },
    );
  } finally {
    stub.restore();
  }
});
