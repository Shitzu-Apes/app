import assert from "node:assert/strict";
import test from "node:test";

import {
  assertSolanaMint,
  clearRoutedPairs,
  executeSolanaSwap,
  intearQuoter,
  quoteOnSolana,
  quoterFor,
} from "../src/bridge/aggregators.ts";
import type { Rail } from "../src/bridge/rail.ts";

const live = { skip: !process.env.INTEAR_LIVE || !process.env.JUPITER_LIVE };

/**
 * The execution budget, without the waiting.
 *
 * A *search* quote now gets a single attempt — it scores seven rails at once and
 * can lose one to a cold router — while a leg with a signature behind it gets the
 * full budget. These tests are about the retry itself, which is the execution's
 * behaviour, so they ask for it explicitly. The schedule is exercised on its own in
 * `bridgeIntearRetry.test.ts`, where the timing is the assertion; five seconds of
 * real backoff per case would only slow the suite.
 */
/** Five: the budget an execution leg runs with, which is what is under test. */
const FAST = { backoffMs: [] as number[], attempts: 5 };

const NEAR_ACCOUNT = "shitzu.sputnik-dao.near";
const WNEAR = "wrap.near";
const WNEAR_SOL = "3ZLekZYq2qkZiSpnSvabjit34tUkjSwD1JFuW9as9wBG";

const rail = (sourceAddress: string): Rail => ({
  tokenId: "T",
  symbol: "T",
  icon: "/t.webp",
  sourceAddress,
  destAddress: "dest",
  sourceDecimals: 9,
  destDecimals: 9,
});

test("the Solana quoter is chosen for Solana and refuses the rest", () => {
  assert.equal(quoterFor("solana"), quoteOnSolana);
  // There is no aggregator wired up for the EVM chains: none of them has
  // liquidity in a token this bridge can deliver, so a quoter there would only
  // ever quote a route that cannot complete.
  assert.throws(() => quoterFor("base"), /No aggregator/);
  assert.throws(() => quoterFor("ethereum"), /No aggregator/);
});

test("a NEAR quote is refused without the signing account", () => {
  // The API calls it optional. It is not: without it the router omits the
  // deposit actions its own routes depend on.
  assert.throws(() => quoterFor("near"), /needs the account that will sign/);
  assert.doesNotThrow(() => quoterFor("near", { traderAccountId: "a.near" }));
});

test("a zero or negative amount is never sent to an aggregator", async () => {
  assert.equal(await quoteOnSolana("from", "to", 0n), null);
  assert.equal(await quoteOnSolana("from", "to", -1n), null);
});

test("the route readout names the venues in order", () => {
  assert.equal(
    quoteOnSolana.describe({
      guaranteedOut: 1n,
      estimatedOut: 1n,
      dexes: ["Denali", "1DEX", "Meteora DLMM"],
      outputToken: "out",
    }),
    "Denali → 1DEX → Meteora DLMM",
  );
});

test("a malformed mint is rejected before anything is signed", () => {
  assert.equal(
    assertSolanaMint(rail("So11111111111111111111111111111111111111112")),
    "So11111111111111111111111111111111111111112",
  );
  // A NEP-141 contract id is not a mint. Letting it through would fail deep
  // inside Jupiter with a message about the wrong chain entirely.
  assert.throws(
    () => assertSolanaMint(rail("token.0xshitzu.near")),
    /no usable Solana mint/,
  );
  assert.throws(
    () => assertSolanaMint(rail("not a mint")),
    /no usable Solana mint/,
  );
});

test("executeSolanaSwap is a thin wrapper, not a second code path", () => {
  // It deliberately takes a signed-transaction builder rather than a quote, so
  // the caller cannot accidentally send a transaction built from a stale quote.
  assert.equal(typeof executeSolanaSwap, "function");
  assert.equal(executeSolanaSwap.length, 2);
});

test(
  "live: NEAR quotes wNEAR into SHITZU and names the venue",
  live,
  async () => {
    const quote = await intearQuoter(NEAR_ACCOUNT, FAST)(
      WNEAR,
      "token.0xshitzu.near",
      10n ** 24n,
    );
    assert.ok(quote, "expected a route");
    // The floor is what the search ranks on, so it has to be a real number
    // rather than zero, and the estimate must not be below it.
    assert.ok(quote!.guaranteedOut > 0n);
    assert.ok(quote!.estimatedOut >= quote!.guaranteedOut);
    assert.equal(quote!.outputToken, "token.0xshitzu.near");
    assert.ok(quote!.dexes.length > 0);
  },
);

test(
  "live: NEAR quotes native NEAR into wNEAR through the Wrap dex",
  live,
  async () => {
    const quote = await intearQuoter(NEAR_ACCOUNT, FAST)(
      "near",
      WNEAR,
      10n ** 24n,
    );
    assert.ok(quote, "expected a route");
    assert.deepEqual(quote!.dexes, ["Wrap"]);
    // Wrapping is 1:1, which is the case that proves the router is not quietly
    // applying a spread to a conversion that should be free.
    assert.equal(quote!.guaranteedOut, 10n ** 24n);
  },
);

test("live: a NEAR pair with no pool is null, not an error", live, async () => {
  const quote = await intearQuoter(NEAR_ACCOUNT, FAST)(
    WNEAR,
    "definitely.not.a.real.token.near",
    10n ** 24n,
  );
  assert.equal(quote, null);
});

test(
  "live: Solana quotes wNEAR into PURGE, the one meme token Jupiter will trade",
  live,
  async () => {
    // SHITZU, OMGY, JLU and POPPY all answer TOKEN_NOT_TRADABLE here, at any
    // amount, and JAMBO has an Orca pool but Jupiter does not route it yet —
    // still NO_ROUTES_FOUND. PURGE is the one meme token with a routable
    // Solana pool, which is why Convert-to-Solana is thin today.
    const quote = await quoteOnSolana(
      WNEAR_SOL,
      "GqcYoMUr1x4N3kU7ViFd3T3EUx3C2cWKRdWFjYxSkKuh",
      10n ** 9n,
    );
    assert.ok(quote, "expected a route");
    assert.ok(quote!.guaranteedOut > 0n);
    assert.ok(quote!.dexes.length > 0);
  },
);

test(
  "live: Solana reports an untradable meme token as no route",
  live,
  async () => {
    // The distinction matters: this is a market fact, not a request we got wrong,
    // and the UI shows it as "no route available" rather than as an error.
    const quote = await quoteOnSolana(
      WNEAR_SOL,
      "AFbJW5rdaGidnF6o8ZqTtkDBpq3fotSBdJN8fGRN3VRS",
      10n ** 9n,
    );
    assert.equal(quote, null);
  },
);

test("a pair that has routed once is retried when it comes back empty", async () => {
  // The router intermittently answers [] for a pair that routes, so without this a
  // user typing an amount sees "no route" for a market that is plainly there.
  clearRoutedPairs();
  const original = globalThis.fetch;
  let calls = 0;
  const quote = intearQuoter(NEAR_ACCOUNT, FAST);
  globalThis.fetch = (async () => {
    calls++;
    // One cold blip: the first call routes, the next answers the empty list the
    // router returns for a pair it has not warmed up, and the retry routes again.
    const body =
      calls === 2
        ? []
        : [
            {
              dex_id: "Rhea",
              estimated_amount: { amount_out: "2000" },
              worst_case_amount: { amount_out: "1900" },
              token_output: "token.0xshitzu.near",
              execution_instructions: [
                {
                  NearTransaction: {
                    receiver_id: "v2.ref-finance.near",
                    actions: [],
                  },
                },
              ],
            },
          ];
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  try {
    const first = await quote("wrap.near", "token.0xshitzu.near", 1000n);
    assert.ok(first, "the first call routes");
    assert.equal(calls, 1);

    const second = await quote("wrap.near", "token.0xshitzu.near", 1000n);
    assert.ok(second, "a known-good pair is retried rather than reported dead");
    assert.equal(second.guaranteedOut, 1900n);
    // Three calls total: the first quote landed on call 1, and this one was empty
    // on call 2 and routed on call 3. One retry, then it stops.
    assert.equal(calls, 3, "a route on the second attempt, then it stops");
  } finally {
    globalThis.fetch = original;
    clearRoutedPairs();
  }
});

test("a pair's very first call is retried too, because that is the cold one", async () => {
  // The rule used to retry only a pair already known to route, which is exactly
  // backwards for a cold process: the pairs least likely to be in the set are the
  // ones being asked for the first time. Measured live, NEAR -> USDC on NEAR
  // answered "no route" on its first call and 5.19 USDC on the second, so every
  // fresh page load made a working same-chain swap a coin flip.
  clearRoutedPairs();
  const original = globalThis.fetch;
  let calls = 0;
  const quote = intearQuoter(NEAR_ACCOUNT, FAST);
  globalThis.fetch = (async () => {
    calls++;
    // Cold on the first call only, which is the failure being pinned.
    if (calls === 1) return new Response(JSON.stringify([]), { status: 200 });
    return new Response(
      JSON.stringify([
        {
          dex_id: "Rhea",
          estimated_amount: { amount_out: "5195398" },
          worst_case_amount: { amount_out: "5195398" },
          token_output: "usdt.tether-token.near",
          execution_instructions: [
            {
              NearTransaction: {
                receiver_id: "v2.ref-finance.near",
                actions: [],
              },
            },
          ],
        },
      ]),
      { status: 200 },
    );
  }) as typeof fetch;
  try {
    const leg = await quote("wrap.near", "usdt.tether-token.near", 10n ** 24n);
    assert.ok(leg, "a never-seen pair is not reported dead on a cold answer");
    assert.equal(leg.guaranteedOut, 5195398n);
    assert.equal(calls, 2, "one retry, and no more");
  } finally {
    globalThis.fetch = original;
    clearRoutedPairs();
  }
});

test("a pair that stays empty stops after the attempt budget", async () => {
  // The retry guards against a cold router, not against a market that genuinely
  // closed. A pair that was real and is now gone must still be reported gone.
  clearRoutedPairs();
  const original = globalThis.fetch;
  let calls = 0;
  const quote = intearQuoter(NEAR_ACCOUNT, FAST);
  const route = [
    {
      dex_id: "Rhea",
      estimated_amount: { amount_out: "2000" },
      worst_case_amount: { amount_out: "1900" },
      token_output: "token.0xshitzu.near",
      execution_instructions: [
        { NearTransaction: { receiver_id: "r.near", actions: [] } },
      ],
    },
  ];
  globalThis.fetch = (async () => {
    calls++;
    return new Response(JSON.stringify(calls === 1 ? route : []), {
      status: 200,
    });
  }) as typeof fetch;
  try {
    assert.ok(await quote("wrap.near", "token.0xshitzu.near", 1000n));
    assert.equal(await quote("wrap.near", "token.0xshitzu.near", 1000n), null);
    // The stub routes once and is empty from call 2 on, so this second quote spends
    // the whole budget: five attempts, then it is believed.
    assert.equal(calls, 6, "the attempt budget, then it is believed");
  } finally {
    globalThis.fetch = original;
    clearRoutedPairs();
  }
});

test("a pair that never routes still stops after the attempt budget", async () => {
  // This used to assert a single call, on the reasoning that most candidates have
  // no pool and an empty answer for one is the truth. That reasoning priced the
  // retry against the wrong thing: a *never-seen* pair is precisely the one whose
  // first answer is unreliable, because a cold process is what makes it
  // unreliable. The invariant that matters is the bound, not the count.
  clearRoutedPairs();
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return new Response("[]", { status: 200 });
  }) as typeof fetch;
  try {
    const quote = await intearQuoter(NEAR_ACCOUNT, FAST)(
      "wrap.near",
      "some.dead.pair.near",
      1000n,
    );
    assert.equal(quote, null, "a genuinely dead pair is still reported dead");
    // Bounded, because empty is also the right answer for a token with no pool.
    // Five attempts, waited between: the empties arrive in bursts of several, so
    // retrying immediately is what made "empty array multiple times in a row" fail
    // even with a retry in place.
    assert.equal(
      calls,
      5,
      "five attempts and no more, so a dead pair is bounded",
    );
  } finally {
    globalThis.fetch = original;
    clearRoutedPairs();
  }
});

test("a rate-limited search quote is asked again rather than dropped", async () => {
  // The bridge page walks into the router's limit in ordinary use: one search is
  // several requests at once. A 429 used to propagate out of here, where the rail's
  // catch in `search.ts` turned it into "no route" — so the best rail could vanish
  // from the list for a reason nothing in the response explained.
  clearRoutedPairs();
  const original = globalThis.fetch;
  const realRandom = Math.random;
  Math.random = () => 0;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    if (calls === 1) {
      // With the header the router actually sends, so the retry is immediate.
      return new Response(
        "Rate limit exceeded, retry in 5s or use an API key",
        {
          status: 429,
          headers: { "retry-after": "0" },
        },
      );
    }
    return new Response(
      JSON.stringify([
        {
          dex_id: "Rhea",
          estimated_amount: { amount_out: "2000" },
          worst_case_amount: { amount_out: "1900" },
          token_output: "token.0xshitzu.near",
          execution_instructions: [
            {
              NearTransaction: {
                receiver_id: "v2.ref-finance.near",
                actions: [],
              },
            },
          ],
        },
      ]),
      { status: 200 },
    );
  }) as typeof fetch;
  try {
    // The app's own search budget, not an explicit one: defaults, deliberately.
    const quote = await intearQuoter(NEAR_ACCOUNT)(
      "wrap.near",
      "token.0xshitzu.near",
      1000n,
    );
    assert.ok(quote, "the rate-limited quote still routed");
    assert.equal(quote!.guaranteedOut, 1900n);
    assert.equal(calls, 2, "one re-ask, then the route");
  } finally {
    Math.random = realRandom;
    globalThis.fetch = original;
    clearRoutedPairs();
  }
});
