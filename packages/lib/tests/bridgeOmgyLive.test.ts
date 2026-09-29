import assert from "node:assert/strict";
import test from "node:test";

process.env.VITE_NETWORK_ID = "mainnet";

const { searchRoutes } = await import("../src/bridge/search.ts");
const { intearQuoter, quoteOnSolana } = await import(
  "../src/bridge/aggregators.ts"
);
const { getBridgeFee } = await import("../src/bridge/fee.ts");

/**
 * The same dependencies `routeSearch.ts` builds, assembled here.
 *
 * That module reaches the token registry and through it the wallet modules, so it
 * cannot be loaded outside a SvelteKit build. The wiring being tested is the rail
 * search's, and this reproduces the real aggregator and fee calls around it rather
 * than stubbing them, so the test is still against live liquidity.
 */
const NEAR_ACCOUNT = "shitzu.sputnik-dao.near";
/** Any valid Solana address; only its shape matters to the fee endpoint. */
const SOLANA_RECIPIENT = "9yDCicRqNmtUEX3z2krBiZ6GaYQba6NRFrLtcVBXozcT";

function deps(source: "near" | "solana", dest: "near" | "solana") {
  const sourceQuoter =
    source === "near" ? intearQuoter(NEAR_ACCOUNT) : quoteOnSolana;
  const destQuoter =
    dest === "near" ? intearQuoter(NEAR_ACCOUNT) : quoteOnSolana;
  const sourceTokenAddress =
    source === "near"
      ? "usdt.tether-token.near"
      : "So11111111111111111111111111111111111111112";
  const targetTokenAddress =
    dest === "near"
      ? "omgy-1992.meme-cooking.near"
      : "7krfuHcr3doqGj4iebBRDfJ29ugdNA4yjHBq7yL82wQa";

  // A recipient has to be an address on the destination chain, so the
  // cross-chain case cannot reuse the NEAR account the same-chain case sends from.
  const recipient = dest === "near" ? NEAR_ACCOUNT : SOLANA_RECIPIENT;

  return {
    quoteSourceSwap: (
      rail: { sourceAddress: string; destAddress: string },
      amountIn: bigint,
    ) => sourceQuoter(sourceTokenAddress, rail.sourceAddress, amountIn),
    quoteTargetSwap: (
      rail: { sourceAddress: string; destAddress: string },
      amountIn: bigint,
    ) => destQuoter(rail.destAddress, targetTokenAddress, amountIn),
    quoteBridgeFee: (rail: { sourceAddress: string }, amount: bigint) =>
      getBridgeFee({
        from: source,
        to: dest,
        sender: NEAR_ACCOUNT,
        recipient,
        tokenAddress: rail.sourceAddress,
        amount,
      }),
    quoteSameChainSwap: (amountIn: bigint) =>
      sourceQuoter(sourceTokenAddress, targetTokenAddress, amountIn),
  };
}

/**
 * The reported case, against the live aggregators.
 *
 * OMGY could not be bought. The route search wanted to swap on the Solana side
 * and bridge to NEAR, but OMGY's Solana mint is `TOKEN_NOT_TRADABLE` on Jupiter —
 * verified. The answer is that the target belongs on NEAR, so the conversion
 * should be a same-chain swap rather than a bridge at all.
 */
const live = { skip: !process.env.INTEAR_LIVE || !process.env.JUPITER_LIVE };

const REGISTRY = {
  NEAR: {
    symbol: "NEAR",
    icon: "/wnear.webp",
    decimals: { near: 24, solana: 9 },
    addresses: {
      near: "wrap.near",
      solana: "3ZLekZYq2qkZiSpnSvabjit34tUkjSwD1JFuW9as9wBG",
    },
  },
  OMGY: {
    symbol: "OMGY",
    icon: "",
    decimals: { near: 18, solana: 9 },
    addresses: {
      near: "omgy-1992.meme-cooking.near",
      solana: "7krfuHcr3doqGj4iebBRDfJ29ugdNA4yjHBq7yL82wQa",
    },
  },
};

test("live: USDT buys OMGY on NEAR as a same-chain swap", live, async () => {
  // The Intear router intermittently answers an empty list for a pair that routes
  // moments later — measured at roughly one call in three from a cold process, and
  // it is the router's own state, not a fact about OMGY. The production client
  // retries a pair it has already seen route; a fresh test process has no such
  // memory, so it retries here instead. What is being asserted is that the route
  // exists and takes the same-chain shape.
  let plans: Awaited<ReturnType<typeof searchRoutes>>["plans"] = [];
  for (let attempt = 0; attempt < 4 && plans.length === 0; attempt++) {
    plans = (
      await searchRoutes(
        {
          registry: REGISTRY,
          source: "near",
          dest: "near",
          sourceTokenId: "usdt.tether-token.near",
          targetTokenId: "OMGY",
          amount: 1_000_000_000n, // 1000 USDT at 6 decimals
        },
        deps("near", "near"),
      )
    ).plans;
  }

  assert.ok(plans.length > 0, "OMGY should be reachable on NEAR");
  assert.equal(plans[0].kind, "swap", "no bridge is involved");
  assert.ok(plans[0].receiveAmount! > 0n);
});

test(
  "live: OMGY on Solana can only arrive by direct bridge",
  live,
  async () => {
    // OMGY's Solana mint is `TOKEN_NOT_TRADABLE` on Jupiter, verified. So a route
    // that delivers OMGY on Solana cannot finish with a swap on the Solana side; if
    // one is offered at all, the rail has to *be* OMGY and the bridge has to carry
    // it. This asserts that invariant rather than claiming the route is impossible,
    // because whether the bridge honours that registration is a separate question
    // the search does not and cannot cheaply verify.
    const { plans } = await searchRoutes(
      {
        registry: REGISTRY,
        source: "near",
        dest: "solana",
        sourceTokenId: "usdt.tether-token.near",
        targetTokenId: "OMGY",
        amount: 1_000_000_000n,
      },
      deps("near", "solana"),
    );

    for (const plan of plans) {
      if (plan.targetSymbol !== "OMGY") continue;
      // The only way to finish is the token itself, carried by the bridge.
      assert.equal(plan.rail?.tokenId, "OMGY", "OMGY must be the rail");
      assert.equal(
        plan.targetSwap,
        null,
        "nothing can be swapped into it on Solana",
      );
    }
  },
);
