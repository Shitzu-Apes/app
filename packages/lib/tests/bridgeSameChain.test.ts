import assert from "node:assert/strict";
import test from "node:test";

import type { Registry } from "../src/bridge/rail.ts";
import { searchRoutes, planKey, type SwapLeg } from "../src/bridge/search.ts";

/**
 * Same-chain conversion.
 *
 * The case that forced this: OMGY has no Solana liquidity at all (Jupiter answers
 * TOKEN_NOT_TRADABLE for its mint) but routes fine on NEAR, so buying it with
 * USDC while already on NEAR is a plain swap. Before this existed, a user who
 * picked OMGY as a target was told "no route available" and a token visible in the
 * picker looked unreachable.
 */
const registry: Registry = {
  NEAR: {
    symbol: "NEAR",
    icon: "/n.webp",
    decimals: { near: 24, solana: 9 },
    addresses: { near: "wrap.near", solana: "So1111" },
  },
  SHITZU: {
    symbol: "SHITZU",
    icon: "/s.webp",
    decimals: { near: 18, solana: 9 },
    addresses: { near: "token.0xshitzu.near", solana: "AFbJW5" },
  },
};

const leg = (out: bigint): SwapLeg => ({
  guaranteedOut: out,
  estimatedOut: out,
  dexes: ["Rhea"],
  outputToken: "out",
});

function deps(
  over: { same?: (amount: bigint) => Promise<SwapLeg | null> } = {},
) {
  return {
    // Each leg returns a whole number of the *output* token's units. Returning
    // `amount / 2` would be denominated in the input's decimals, which against an
    // 18-decimal target is a fraction of one token and trips the dust guard.
    quoteSourceSwap: async () => leg(FIVE_SHITZU),
    quoteTargetSwap: async () => leg(5n * 10n ** 9n),
    quoteBridgeFee: async () => ({ tokenFee: 0n, nativeFee: 0n, usdFee: null }),
    quoteSameChainSwap: over.same ?? (async () => leg(FIVE_SHITZU)),
  };
}

/**
 * 1M USDT at 6 decimals.
 *
 * The size matters: SHITZU is 18 decimals on NEAR, so a small amount buys a
 * fraction of one token and the search correctly rejects it as dust. A fixture
 * that ignored that would make every assertion here pass for the wrong reason.
 */
const ONE_M_USDT = 1_000_000n * 10n ** 6n;

/** Five whole tokens at SHITZU's own 18 decimals. */
const FIVE_SHITZU = 5n * 10n ** 18n;

const base = {
  registry,
  source: "near" as const,
  dest: "near" as const,
  sourceTokenId: "usdt.tether-token.near",
  targetTokenId: "SHITZU",
  amount: ONE_M_USDT,
};

test("a same-chain conversion is one swap and no route via a rail", async () => {
  const { plans } = await searchRoutes(base, deps());
  assert.equal(plans.length, 1);
  assert.equal(plans[0].kind, "swap");
  // A swap plan has no rail. Inventing one would make the UI render a bridge step
  // that does not happen, and quote a fee that is never charged.
  assert.equal(plans[0].rail, null);
});

test("a swap plan claims no bridged amount and no fee", async () => {
  const { plans } = await searchRoutes(base, deps());
  assert.equal(plans[0].bridgedAmount, 0n);
  assert.equal(plans[0].tokenFee, 0n);
  assert.equal(plans[0].nativeFee, 0n);
  assert.equal(plans[0].arrivedAmount, 0n);
});

test("a same-chain swap is ranked on what it delivers", async () => {
  const { plans } = await searchRoutes(base, deps());
  assert.equal(plans[0].receiveAmount, FIVE_SHITZU);
});

test("a pair with no route on the same chain yields nothing", async () => {
  // The aggregator answering "no route" is a market fact, not an error.
  const { plans, rejected } = await searchRoutes(
    base,
    deps({ same: async () => null }),
  );
  assert.deepEqual(plans, []);
  assert.deepEqual(rejected, []);
});

test("a sub-unit output is not offered", async () => {
  // SHITZU is 18 decimals on NEAR, so one base unit is dust and would render as
  // "0.00" in the summary — a route promising a balance that rounds away.
  const { plans } = await searchRoutes(
    base,
    deps({ same: async () => leg(1n) }),
  );
  assert.deepEqual(plans, []);
});

test("spending a token to receive it is not a conversion", async () => {
  const { plans } = await searchRoutes(
    { ...base, targetTokenId: base.sourceTokenId },
    deps(),
  );
  assert.deepEqual(plans, []);
});

test("a swap plan still has a stable key without a rail", async () => {
  // Two swap plans both have `rail === null`, so keying on the rail would collapse
  // them onto `undefined` and make the list unkeyable.
  const { plans } = await searchRoutes(base, deps());
  assert.equal(typeof planKey(plans[0]), "string");
  assert.match(planKey(plans[0]), /^swap:/);
});

test("a bridge plan is keyed by its rail", async () => {
  const { plans } = await searchRoutes(
    { ...base, dest: "solana" as const },
    deps(),
  );
  assert.equal(planKey(plans[0]), plans[0].rail?.tokenId);
});

test("an aborted same-chain search returns nothing", async () => {
  const controller = new AbortController();
  controller.abort();
  const { plans } = await searchRoutes(
    { ...base, signal: controller.signal },
    deps(),
  );
  assert.deepEqual(plans, []);
});

test("a throwing aggregator is not an error, it is no route", async () => {
  const original = console.error;
  console.error = () => {};
  try {
    const { plans } = await searchRoutes(
      base,
      deps({
        same: async () => {
          throw new Error("aggregator 502");
        },
      }),
    );
    assert.deepEqual(plans, []);
  } finally {
    console.error = original;
  }
});

test("a cross-chain route is still a bridge", async () => {
  // Same-chain support must not have changed the cross-chain path.
  const { plans } = await searchRoutes(
    { ...base, dest: "solana" as const },
    deps(),
  );
  assert.equal(plans[0].kind, "bridge");
  assert.ok(plans[0].rail);
});
