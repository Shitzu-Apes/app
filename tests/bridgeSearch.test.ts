import assert from "node:assert/strict";
import test from "node:test";

import { isSubUnit, rebaseAmount } from "../src/lib/bridge/amount.ts";
import { labelFor } from "../src/lib/bridge/format.ts";
import type { Registry } from "../src/lib/bridge/rail.ts";
import {
  describePlan,
  isNativePlan,
  searchRoutes,
  type BridgeFeeQuote,
  type RouteSearchDeps,
  type SwapLeg,
} from "../src/lib/bridge/search.ts";

/** The three rails that matter for the worked example, plus NEAR and wNEAR. */
const registry: Registry = {
  NEAR: {
    symbol: "NEAR",
    icon: "/n.webp",
    decimals: { near: 24, solana: 9 },
    addresses: { near: "wrap.near", solana: "So111" },
  },
  SHITZU: {
    symbol: "SHITZU",
    icon: "/s.webp",
    decimals: { near: 18, solana: 9 },
    addresses: { near: "token.0xshitzu.near", solana: "AFbJW5" },
  },
  OMGY: {
    symbol: "OMGY",
    icon: "/o.webp",
    decimals: { near: 18, solana: 9 },
    addresses: { near: "omgy-1992.meme-cooking.near", solana: "7krfuH" },
  },
  // Not on Solana, so never a candidate.
  USDT: {
    symbol: "USDT",
    icon: "/u.webp",
    decimals: { near: 6, solana: undefined },
    addresses: { near: "usdt.tether-token.near", solana: undefined },
  },
  // Solana-only, so it can be a target but never a rail. Used where a test needs
  // every rail to carry both swap legs.
  BONK: {
    symbol: "BONK",
    icon: "/b.webp",
    decimals: { near: undefined, solana: 5 },
    addresses: { near: undefined, solana: "DezXAZ8z" },
  },
};

/**
 * A well-behaved route: what it guarantees is what it expects to deliver.
 *
 * The estimate defaults to the floor rather than to some multiple of it. A
 * fixture that inflates every estimate corrupts the ranking's tie-break, and
 * the direct rail — which has no destination swap, so its "estimate" is just
 * its floor — would then lose to a route that only looks more optimistic.
 */
const leg = (guaranteedOut: bigint, dexes = ["Rhea"]): SwapLeg => ({
  guaranteedOut,
  estimatedOut: guaranteedOut,
  dexes,
  outputToken: "out",
});

/**
 * Prices in billionths of a USDT per whole token, so the fixture can convert by
 * value using integers only.
 *
 * Two things this has to get right. The input is 6-decimal USDT and the rails
 * are 9- and 18-decimal tokens, so a naive 1:1 fixture hands one rail a million
 * more base units than another and the ranking compares nothing but decimal
 * counts. And the arithmetic has to stay integral: converting through floats
 * made two genuinely equal routes differ by a single base unit, so the order was
 * decided by rounding rather than by price.
 */
const PRICE_PER_TOKEN: Record<string, bigint> = {
  NEAR: 1_000_000_000n,
  SHITZU: 500n,
  OMGY: 400n,
};

/** 1 USDT, in billionths. */
const ONE_USDT = 1_000_000_000n;

/** Units of `tokenId` worth `value`, where value is in billionths of a USDT. */
function unitsFor(tokenId: string, value: bigint, decimals: number): bigint {
  return (value * 10n ** BigInt(decimals)) / PRICE_PER_TOKEN[tokenId];
}

/** The value of `amount` units of `tokenId`, in billionths of a USDT. */
function valueOf(tokenId: string, amount: bigint, decimals: number): bigint {
  return (amount * PRICE_PER_TOKEN[tokenId]) / 10n ** BigInt(decimals);
}

/**
 * What a second swap costs, as a fraction.
 *
 * Bridging and then swapping again means paying for two swaps instead of one,
 * which is the entire reason a direct rail is usually the better answer. Having
 * it as the default is what lets the ranking tests assert something real rather
 * than a tie.
 */
const SECOND_SWAP_NUM = 99n;
const SECOND_SWAP_DEN = 100n;

type Overrides = Partial<{
  source: (railTokenId: string, amountIn: bigint) => SwapLeg | null;
  target: (railTokenId: string, amountIn: bigint) => SwapLeg | null;
  fee: (railTokenId: string, amount: bigint) => BridgeFeeQuote;
}>;

function deps(
  overrides: Overrides = {},
): RouteSearchDeps & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    quoteSourceSwap: async (rail, amountIn) => {
      calls.push(`source:${rail.tokenId}`);
      if (overrides.source) return overrides.source(rail.tokenId, amountIn);
      return leg(unitsFor(rail.tokenId, ONE_USDT, rail.sourceDecimals));
    },
    quoteTargetSwap: async (rail, amountIn) => {
      calls.push(`target:${rail.tokenId}`);
      if (overrides.target) return overrides.target(rail.tokenId, amountIn);
      const value = valueOf(rail.tokenId, amountIn, rail.destDecimals);
      return leg(
        unitsFor("SHITZU", (value * SECOND_SWAP_NUM) / SECOND_SWAP_DEN, 9),
      );
    },
    quoteBridgeFee: async (rail, amount) => {
      calls.push(`fee:${rail.tokenId}`);
      return (
        overrides.fee?.(rail.tokenId, amount) ?? {
          tokenFee: amount / 100n,
          nativeFee: 50_000n,
          usdFee: 0.01,
        }
      );
    },
  };
}

const base = {
  registry,
  source: "near" as const,
  dest: "solana" as const,
  // 1 USDT, 6 decimals.
  amount: 1_000_000n,
  /**
   * The rails this fixture's world has a Solana pool for.
   *
   * Nothing else in this file is about the liquidity rule, and the real list is closed
   * to wNEAR and SHITZU — which would drop OMGY from every ranking below and quietly
   * turn them into tests of the whitelist. What that rule actually does is asserted in
   * `bridgeSolanaLiquidity`, against the real list.
   */
  solanaLiquidity: new Set(["NEAR", "SHITZU", "OMGY", "BONK"]),
};

// --- re-basing across the bridge -------------------------------------------------

test("re-basing scales up when the destination has more decimals", () => {
  // 0.2 wNEAR leaves Solana as 200_000_000 SPL units and arrives on NEAR as
  // 200_000_000_000_000_000_000_000. The bridge preserves value, not raw units.
  assert.equal(
    rebaseAmount(200_000_000n, 9, 24),
    200_000_000_000_000_000_000_000n,
  );
});

test("re-basing is the identity when both ends agree", () => {
  assert.equal(rebaseAmount(12345n, 18, 18), 12345n);
});

test("re-basing down truncates rather than rounding", () => {
  // Matches the bridge contract, which works in integers. The lost dust is under
  // 10^-15 of a token and cannot be clawed back.
  assert.equal(rebaseAmount(1_999_999_999_999_999n, 18, 9), 1_999_999n);
});

test("re-basing round-trips the value, not the digits", () => {
  const spl = 250_000_000n;
  const near = rebaseAmount(spl, 9, 24);
  assert.equal(rebaseAmount(near, 24, 9), spl);
});

test("a sub-unit amount is recognised as one", () => {
  assert.equal(isSubUnit(1n, 18), true);
  assert.equal(isSubUnit(10n ** 18n - 1n, 18), true);
  assert.equal(isSubUnit(10n ** 18n, 18), false);
  assert.equal(isSubUnit(0n, 18), false);
  // Zero decimals would make any amount a whole number of tokens.
  assert.equal(isSubUnit(1n, 0), false);
});

// --- the worked example ----------------------------------------------------------

test("USDT on NEAR to SHITZU on Solana routes through SHITZU, not wNEAR", async () => {
  // The case that motivates searching rails at all. Nothing can swap onward into
  // SHITZU on Solana — Jupiter reports it as not tradable there — so only the
  // rail that *is* SHITZU survives, and it needs no second swap.
  const { plans, rejected } = await searchRoutes(
    { ...base, sourceTokenId: "USDT", targetTokenId: "SHITZU" },
    deps({ target: () => null }),
  );

  assert.equal(plans.length, 1);
  assert.equal(plans[0].rail.tokenId, "SHITZU");
  assert.equal(plans[0].sourceSwap !== null, true);
  assert.equal(plans[0].targetSwap, null, "no second swap is needed");
  assert.equal(describePlan(plans[0]), "USDT -> SHITZU");

  assert.deepEqual(
    rejected.map((r) => `${r.rail.tokenId}:${r.reason}`).sort(),
    ["NEAR:no-target-route", "OMGY:no-target-route"],
  );
});

test("a direct rail beats routing through wNEAR when both work", async () => {
  // All three rails finish, so this is a real comparison. Bridging SHITZU keeps
  // the whole amount because there is no second swap; the others pay for one,
  // and wNEAR's pool is the thinnest of the three.
  const { plans } = await searchRoutes(
    { ...base, sourceTokenId: "USDT", targetTokenId: "SHITZU" },
    deps({
      target: (railTokenId, amountIn) => {
        const value = valueOf(railTokenId, amountIn, 9);
        const kept = railTokenId === "NEAR" ? (value * 3n) / 5n : value;
        return leg(
          unitsFor("SHITZU", (kept * SECOND_SWAP_NUM) / SECOND_SWAP_DEN, 9),
        );
      },
    }),
  );
  assert.deepEqual(
    plans.map((p) => p.rail.tokenId),
    ["SHITZU", "OMGY", "NEAR"],
  );
});

test("ranks on the guaranteed figure, not the estimate", async () => {
  // The greedy route advertises five times as much and guarantees less. Ranking
  // on the estimate would put it first and the user would receive less. BONK is
  // the target so every rail needs both legs and the destination swap, not the
  // re-basing, is what decides the order.
  const greedy: SwapLeg = {
    guaranteedOut: 100_000n,
    estimatedOut: 5_000_000n,
    dexes: ["Rhea"],
    outputToken: "bonk",
  };
  const honest: SwapLeg = {
    guaranteedOut: 300_000n,
    estimatedOut: 320_000n,
    dexes: ["Rhea"],
    outputToken: "bonk",
  };
  const { plans } = await searchRoutes(
    { ...base, sourceTokenId: "USDT", targetTokenId: "BONK" },
    deps({
      target: (railTokenId) => (railTokenId === "NEAR" ? greedy : honest),
    }),
  );
  // SHITZU and OMGY tie on the floor, so they keep the registry's order. The
  // point is that NEAR, with by far the largest estimate, comes last.
  assert.deepEqual(
    plans.map((p) => p.rail.tokenId),
    ["SHITZU", "OMGY", "NEAR"],
  );
});

test("identical searches produce an identical order", async () => {
  const run = () =>
    searchRoutes(
      { ...base, sourceTokenId: "USDT", targetTokenId: "SHITZU" },
      deps({ target: () => leg(10n ** 9n) }),
    ).then((r) => r.plans.map((p) => p.rail.tokenId).join(","));
  assert.equal(await run(), await run());
});

// --- the native path -------------------------------------------------------------

test("bridging a token unchanged needs no swap on either side", async () => {
  const d = deps();
  const { plans } = await searchRoutes(
    {
      ...base,
      sourceTokenId: "SHITZU",
      targetTokenId: "SHITZU",
      // SHITZU is 18 decimals on NEAR, so the input has to be in those units.
      amount: 1_000n * 10n ** 18n,
    },
    d,
  );
  const shitzu = plans.find((p) => p.rail.tokenId === "SHITZU");
  assert.ok(shitzu, "the token's own rail must be available");
  assert.equal(isNativePlan(shitzu!), true);
  assert.equal(describePlan(shitzu!), "SHITZU -> SHITZU");
  // A pure bridge needs no *swap* quote, and must not pay for one. The bridge fee is a
  // different matter: the bridge charges it whether or not a swap is involved, so the
  // fee is quoted here too. It used to be skipped for exactly this route, which made
  // the summary report no fee on the one route that is simplest while the deposit took
  // one.
  assert.equal(d.calls.includes("fee:SHITZU"), true, "the fee is still quoted");
  assert.equal(d.calls.includes("source:SHITZU"), false);
  assert.equal(d.calls.includes("target:SHITZU"), false);
});

test("a native bridge is re-based onto the destination's decimals", async () => {
  // 1000 SHITZU on NEAR at 18 decimals must arrive on Solana at 9, not as
  // 1000 raw units, which would be a billionth of a token.
  const { plans } = await searchRoutes(
    {
      ...base,
      sourceTokenId: "SHITZU",
      targetTokenId: "SHITZU",
      amount: 1_000n * 10n ** 18n,
    },
    deps(),
  );
  const shitzu = plans.find((p) => p.rail.tokenId === "SHITZU")!;
  assert.equal(shitzu.bridgedAmount, 1_000n * 10n ** 18n);
  // The fee is taken out of the amount rather than added on top, so what arrives is
  // the bridged amount less the bridge's own cut — 1% of it, per the fee fixture.
  const fee = shitzu.bridgedAmount / 100n / 10n ** 9n;
  assert.equal(shitzu.tokenFee, (1_000n * 10n ** 18n) / 100n);
  assert.equal(shitzu.arrivedAmount, 1_000n * 10n ** 9n - fee);
  assert.equal(shitzu.receiveAmount, 1_000n * 10n ** 9n - fee);
});

test("NEAR to NEAR is not a bridge", async () => {
  const { plans } = await searchRoutes(
    {
      ...base,
      source: "near",
      dest: "near",
      sourceTokenId: "USDT",
      targetTokenId: "SHITZU",
    },
    deps(),
  );
  assert.deepEqual(plans, []);
});

test("native NEAR as the target is the wNEAR rail's own arrival", async () => {
  // A Solana token converted into native NEAR is finished when the wNEAR rail
  // lands, because the payout unwraps. The target picker's row for it carries the
  // native `near` address while the rail's registry address is `wrap.near`, so
  // comparing the two literally said a destination swap was needed and then asked
  // the router for NEAR -> NEAR. Every Solana token reported NEAR as unreachable.
  //
  // The target dep quotes a real figure for any rail that needs one, so a missing
  // plan means "rejected", not "the fixture priced zero".
  const d = deps({ target: () => leg(10n ** 23n) });
  const { plans } = await searchRoutes(
    {
      ...base,
      source: "solana",
      dest: "near",
      sourceTokenId: "DezXAZ8z",
      sourceAddress: "DezXAZ8z",
      targetTokenId: "near",
      targetAddress: "near",
      targetDecimals: 24,
    },
    d,
  );
  const near = plans.find((p) => p.rail.tokenId === "NEAR");
  assert.ok(near, "the wNEAR rail carries it");
  assert.equal(near.targetSwap, null, "and needs no destination swap");
  assert.equal(near.receiveAmount, near.arrivedAmount);
  assert.equal(
    d.calls.includes("target:NEAR"),
    false,
    "the router is never asked to swap NEAR into itself",
  );
});

test("wNEAR on Solana straight to native NEAR is the native bridge path", async () => {
  // The conversion the report is about: "near (sol) to near (near) unwraps to
  // native near". Source is the rail, and the payout is the target, so it is one
  // bridge with nothing on either side of it.
  const { plans } = await searchRoutes(
    {
      ...base,
      source: "solana",
      dest: "near",
      sourceTokenId: "So111",
      sourceAddress: "So111",
      targetTokenId: "near",
      targetAddress: "near",
      targetDecimals: 24,
      // 1 NEAR, in wNEAR's 9 decimals — anything under 0.01 NEAR is dust on a
      // 24-decimal chain and is refused by the size rule.
      amount: 1_000_000_000n,
    },
    deps({ target: () => null }),
  );
  const near = plans.find((p) => p.rail.tokenId === "NEAR");
  assert.ok(near, "the wNEAR rail carries it");
  assert.equal(near.sourceSwap, null, "no swap on Solana");
  assert.equal(near.targetSwap, null, "no swap on NEAR");
  assert.equal(isNativePlan(near), true);
});

test("every other rail still needs a real swap into native NEAR", async () => {
  // The mirror: bridging SHITZU does not land as NEAR, so the destination swap is
  // real and must be quoted. Suppressing it would promise the user NEAR and
  // deliver SHITZU.
  const { plans } = await searchRoutes(
    {
      ...base,
      source: "solana",
      dest: "near",
      sourceTokenId: "AFbJW5",
      sourceAddress: "AFbJW5",
      targetTokenId: "near",
      targetAddress: "near",
      targetDecimals: 24,
    },
    deps({ target: () => leg(10n ** 23n) }),
  );
  const shitzu = plans.find((p) => p.rail.tokenId === "SHITZU");
  assert.ok(shitzu, "SHITZU is its own rail");
  assert.ok(shitzu.targetSwap, "and it must be swapped into NEAR");
});

// --- rejections ------------------------------------------------------------------

test("an amount the bridge fee swallows is rejected, not silently rounded", async () => {
  // The fee is near-flat, so on a small transfer it can be the whole amount.
  // Reporting a route here would promise a balance that cannot exist.
  const { plans, rejected } = await searchRoutes(
    { ...base, sourceTokenId: "USDT", targetTokenId: "SHITZU" },
    deps({
      fee: (_railTokenId, amount) => ({
        tokenFee: amount,
        nativeFee: 0n,
        usdFee: null,
      }),
    }),
  );
  assert.deepEqual(plans, []);
  assert.ok(rejected.length > 0);
  assert.ok(rejected.every((r) => r.reason === "too-small"));
});

test("a route into a low-decimal token is judged on that token's decimals", async () => {
  // BONK is 5 decimals on Solana while the rails are 9. 100_000 BONK is an
  // ordinary amount; measured against the rail's 9 decimals it would look like
  // dust and every route into BONK would be rejected.
  const { plans } = await searchRoutes(
    { ...base, sourceTokenId: "USDT", targetTokenId: "BONK" },
    deps({ target: () => leg(100_000n) }),
  );
  assert.equal(plans.length, 3);
  assert.ok(plans.every((p) => p.receiveAmount === 100_000n));
});

test("an output worth less than one whole target token is rejected", async () => {
  // One unit of a 5-decimal token rounds to "0.00" in the summary and reads as
  // a bug rather than as an amount too small to be worth sending. BONK rather
  // than a rail, so that every route really does have a destination swap.
  const { plans, rejected } = await searchRoutes(
    { ...base, sourceTokenId: "USDT", targetTokenId: "BONK" },
    deps({ target: () => leg(1n) }),
  );
  assert.deepEqual(plans, []);
  assert.ok(rejected.every((r) => r.reason === "too-small"));
});

test("a zero amount searches nothing", async () => {
  const { plans, rejected } = await searchRoutes(
    { ...base, sourceTokenId: "USDT", targetTokenId: "SHITZU", amount: 0n },
    deps(),
  );
  assert.deepEqual(plans, []);
  assert.deepEqual(rejected, []);
});

test("one rail throwing does not lose the others", async () => {
  // Three to six of the seven rails have no pool at any moment, and an
  // aggregator error on one should read as "that rail is out".
  const original = console.error;
  console.error = () => {};
  try {
    const { plans } = await searchRoutes(
      { ...base, sourceTokenId: "USDT", targetTokenId: "SHITZU" },
      deps({
        source: (railTokenId) => {
          if (railTokenId === "NEAR") throw new Error("aggregator 502");
          return leg(unitsFor(railTokenId, ONE_USDT, 18));
        },
      }),
    );
    assert.equal(plans.length, 2);
    assert.equal(
      plans.some((p) => p.rail.tokenId === "NEAR"),
      false,
    );
  } finally {
    console.error = original;
  }
});

test("a token absent from the source chain is never a candidate", async () => {
  // USDT is NEAR-only here, so it cannot be the rail to Solana.
  const { plans, rejected } = await searchRoutes(
    { ...base, sourceTokenId: "NEAR", targetTokenId: "SHITZU" },
    deps(),
  );
  assert.ok(plans.every((p) => p.rail.tokenId !== "USDT"));
  assert.ok(rejected.every((r) => r.rail.tokenId !== "USDT"));
});

test("a pinned rail is the only one considered", async () => {
  const { plans } = await searchRoutes(
    {
      ...base,
      sourceTokenId: "USDT",
      targetTokenId: "SHITZU",
      pinnedRailId: "OMGY",
    },
    deps({ target: () => leg(10n ** 9n) }),
  );
  assert.equal(plans.length, 1);
  assert.equal(plans[0].rail.tokenId, "OMGY");
});

test("an aborted search returns nothing rather than stale results", async () => {
  const controller = new AbortController();
  controller.abort();
  const { plans } = await searchRoutes(
    {
      ...base,
      sourceTokenId: "USDT",
      targetTokenId: "SHITZU",
      signal: controller.signal,
    },
    deps(),
  );
  assert.deepEqual(plans, []);
});

test("unknown token ids still produce a readable readout", async () => {
  // The source can be any token the user holds, including ones the bridge does
  // not carry, so its id may not be in the registry.
  const { plans } = await searchRoutes(
    {
      ...base,
      sourceTokenId: "some.newtoken.near",
      targetTokenId: "BONK",
      pinnedRailId: "NEAR",
    },
    deps(),
  );
  assert.equal(plans.length, 1);
  // Shortened rather than raw. A source token is whatever the wallet holds, so
  // its id is usually not in the registry, and a 44-character SPL mint rendered
  // where the token's name belongs was unreadable in the route readout.
  assert.equal(plans[0].sourceSymbol, "some.n…near");
  assert.equal(describePlan(plans[0]), "some.n…near -> NEAR -> BONK");
  // The underlying id is untouched, so the quote and execution still address the
  // real token.
  assert.equal(plans[0].rail.sourceAddress, "wrap.near");
});

test("a known token keeps its symbol rather than being shortened", async () => {
  const { plans } = await searchRoutes(
    {
      ...base,
      sourceTokenId: "SHITZU",
      targetTokenId: "BONK",
      pinnedRailId: "NEAR",
    },
    deps(),
  );
  assert.equal(plans[0].sourceSymbol, "SHITZU");
});

// --- a wallet's address is not the registry's key --------------------------------

/**
 * One whole NEAR, in the rail's own 24 decimals.
 *
 * Distinct from `base`, which is 1 USDT at 6 decimals. When the source *is* the
 * rail there is no swap to rebase the amount, so it is already in the rail's
 * units; quoting another token's units here would be a different, wrong question.
 */
const oneNear = { ...base, amount: 10n ** 24n };

test("a source the wallet names by address is bridged, not swapped", async () => {
  // The bug this pins. A NEAR wallet calls wrapped NEAR `wrap.near`; the registry
  // calls it `NEAR`. Deciding "is this the rail?" on the id alone therefore asked
  // the aggregator to quote `wrap.near` into `wrap.near`, which is not a no-route
  // answer but a 400 — so the rail was discarded and NEAR → wNEAR on Solana, the
  // one conversion that cannot fail, reported "no route available".
  const { plans, rejected } = await searchRoutes(
    {
      ...oneNear,
      sourceTokenId: "wrap.near",
      sourceAddress: "wrap.near",
      targetTokenId: "BONK",
      pinnedRailId: "NEAR",
    },
    deps(),
  );

  assert.equal(plans.length, 1, JSON.stringify(rejected));
  // No swap was even asked for, which is the whole point: a self-swap is not a
  // route to anywhere.
  assert.equal(plans[0].sourceSwap, null);
  // And the bridge fee is quoted even though there is no swap to quote it after. It
  // used to be skipped for exactly this route, so the summary reported no fee while the
  // bridge went on charging one — the simplest route in the form being the only one that
  // said so.
  assert.equal(
    plans[0].tokenFee,
    plans[0].bridgedAmount / 100n,
    "the fee the bridge charges, taken out of the amount",
  );
  assert.notEqual(plans[0].tokenFee, 0n, "and it is not silently nothing");
  assert.equal(plans[0].bridgedAmount, oneNear.amount);
});

test("a source that is the rail by key still needs no swap", async () => {
  // The key path must keep working alongside the address path; they are two doors
  // into the same room, and the registry's callers use this one.
  const { plans, rejected } = await searchRoutes(
    {
      ...oneNear,
      sourceTokenId: "NEAR",
      targetTokenId: "BONK",
      pinnedRailId: "NEAR",
    },
    deps(),
  );
  assert.equal(plans.length, 1, JSON.stringify(rejected));
  assert.equal(plans[0].sourceSwap, null);
});

test("a genuinely different source is still swapped", async () => {
  // The address check must not turn into "skip the swap whenever an address is
  // present", which would quietly claim any token arrives as whatever the rail is.
  const { plans } = await searchRoutes(
    {
      ...base,
      sourceTokenId: "USDT",
      sourceAddress: "usdt.tether-token.near",
      targetTokenId: "BONK",
      pinnedRailId: "NEAR",
    },
    deps(),
  );
  assert.equal(plans.length, 1);
  assert.notEqual(plans[0].sourceSwap, null);
});

test("a target the wallet names by address arrives directly", async () => {
  // The same disagreement on the receiving side, and it costs more: a bridged
  // token the registry has no key for is handed over as an address, so comparing
  // it to the rail's key turned the native bridge path into a self-swap. That is
  // the path for every token the bridge actually carries.
  const { plans } = await searchRoutes(
    {
      ...base,
      sourceTokenId: "USDT",
      targetTokenId: "AFbJW5",
      targetAddress: "AFbJW5",
      pinnedRailId: "SHITZU",
    },
    deps(),
  );
  assert.equal(plans.length, 1);
  assert.equal(plans[0].targetSwap, null);
  // Nothing was swapped on arrival, so the bridged amount is what lands.
  assert.equal(plans[0].receiveAmount, plans[0].arrivedAmount);
});

test("one rail's quoter throwing does not lose the others", async () => {
  // A self-quote or a bad recipient rejects rather than answering "no route", and
  // six of the seven rails having no pool is normal. Neither may empty the list.
  const { plans } = await searchRoutes(
    { ...base, sourceTokenId: "USDT", targetTokenId: "BONK" },
    deps({
      source: (railId) => {
        if (railId === "NEAR") throw new Error("Invalid input token");
        // Value-preserving, so the route is not rejected for being implausible
        // before the throwing rail is ever the interesting one.
        return leg(10n ** 18n);
      },
      target: () => leg(1_000_000n),
    }),
  );
  assert.ok(plans.length > 0, "the other rails still produce routes");
});

test("a target is named by the caller's symbol, not by the registry or the address", async () => {
  // Behavioural, because the readout is what users complained about: the receive
  // picker is almost entirely tokens with no registry key, so `labelFor` shortened
  // every one of their ids into "what happens". Here the registry *does* know the
  // token, and the caller's symbol still wins — which is the case that cannot fall
  // back to anything readable.
  const { plans } = await searchRoutes(
    {
      ...base,
      sourceTokenId: "USDT",
      sourceSymbol: "USDT",
      // BONK's Solana mint, so decimals resolve and the route survives the
      // whole-token check.
      targetTokenId: "DezXAZ8z",
      targetSymbol: "SOLANA BONK",
      pinnedRailId: "NEAR",
    },
    deps(),
  );
  assert.equal(plans.length, 1);
  assert.equal(plans[0].targetSymbol, "SOLANA BONK");
  assert.equal(describePlan(plans[0]), "USDT -> NEAR -> SOLANA BONK");
});

test("without a supplied symbol the target still falls back to a short address", () => {
  // The fallback is not the bug and stays: something has to render when nobody
  // resolved a name.
  const label = labelFor("npro.nearmobile.near", registry);
  assert.match(label, /…/);
});

// The whole-token check, and the decimals it measures against.

test("a target's own decimals decide whether its output counts as a whole token", async () => {
  // The bug this pins, and it is why Solana routing looked broken while the
  // bridge assets worked: the check measures the output against 10^decimals, and
  // for any token the bridge does not carry the search had no decimals and fell
  // back to 18. USDC has 6, so a SOL → USDC conversion on Solana quoted
  // 122,042,006 units and was then thrown away for arriving "less than one whole
  // token" — 122 million of them. The receive picker holds the decimals; the
  // search was guessing.
  const USDC_SOL = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
  const { plans, rejected } = await searchRoutes(
    {
      registry: {},
      source: "solana",
      dest: "solana",
      sourceTokenId: "So11111111111111111111111111111111111111112",
      sourceAddress: "So11111111111111111111111111111111111111112",
      targetTokenId: USDC_SOL,
      targetAddress: USDC_SOL,
      targetDecimals: 6,
      amount: 1_000_000_000n,
    },
    {
      quoteSourceSwap: async () => null,
      quoteTargetSwap: async () => null,
      quoteBridgeFee: async () => ({
        tokenFee: 0n,
        nativeFee: 0n,
        usdFee: null,
      }),
      quoteSameChainSwap: async () => leg(122_042_006n),
    },
  );
  assert.equal(plans.length, 1, JSON.stringify(rejected));
  assert.equal(plans[0].targetDecimals, 6);
  assert.equal(plans[0].receiveAmount, 122_042_006n);
});

test("without the caller's decimals the same route is discarded", async () => {
  // The counterfactual, so the fix cannot be undone by a well-meaning refactor:
  // the quote is identical and correct, and only the missing decimals differ.
  const USDC_SOL = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
  const { plans } = await searchRoutes(
    {
      registry: {},
      source: "solana",
      dest: "solana",
      sourceTokenId: "So11111111111111111111111111111111111111112",
      sourceAddress: "So11111111111111111111111111111111111111112",
      targetTokenId: USDC_SOL,
      targetAddress: USDC_SOL,
      amount: 1_000_000_000n,
    },
    {
      quoteSourceSwap: async () => null,
      quoteTargetSwap: async () => null,
      quoteBridgeFee: async () => ({
        tokenFee: 0n,
        nativeFee: 0n,
        usdFee: null,
      }),
      quoteSameChainSwap: async () => leg(122_042_006n),
    },
  );
  assert.deepEqual(
    plans,
    [],
    "guessing 18 rejects a low-decimal target outright",
  );
});

test("a bridge asset's decimals still come from the registry", async () => {
  // The caller's answer is preferred, not exclusive: a registry entry the app has
  // verified against the bridge must not be overridden by a caller's guess.
  const { plans, rejected } = await searchRoutes(
    {
      ...base,
      sourceTokenId: "USDT",
      targetTokenId: "NEAR",
      pinnedRailId: "NEAR",
    },
    // No fee, so the fixture's 1 USDT arrives as a whole token rather than 0.99
    // of one and being rejected as too small — which would test the wrong thing.
    deps({ fee: () => ({ tokenFee: 0n, nativeFee: 0n, usdFee: null }) }),
  );
  assert.equal(plans.length, 1, JSON.stringify(rejected));
  // 9 on Solana, where wNEAR lives, not the 24 the same token has on NEAR.
  assert.equal(plans[0].targetDecimals, 9);
});

test("native NEAR is recognized whether the caller hands over the id or the address", async () => {
  // The picker resolves both, but a caller with only one of them must not be told a
  // destination swap is needed: it would quote NEAR into itself and drop the route.
  const byId = await searchRoutes(
    {
      ...base,
      source: "solana",
      dest: "near",
      sourceTokenId: "DezXAZ8z",
      sourceAddress: "DezXAZ8z",
      targetTokenId: "near",
      targetDecimals: 24,
    },
    deps({ target: () => leg(10n ** 23n) }),
  );
  const byIdNear = byId.plans.find((p) => p.rail.tokenId === "NEAR");
  assert.ok(byIdNear);
  assert.equal(
    byIdNear.targetSwap,
    null,
    "the id alone identifies the arrival",
  );

  const byAddress = await searchRoutes(
    {
      ...base,
      source: "solana",
      dest: "near",
      sourceTokenId: "DezXAZ8z",
      sourceAddress: "DezXAZ8z",
      targetTokenId: "something-else",
      targetAddress: "near",
      targetDecimals: 24,
    },
    deps({ target: () => leg(10n ** 23n) }),
  );
  const byAddressNear = byAddress.plans.find((p) => p.rail.tokenId === "NEAR");
  assert.ok(byAddressNear);
  assert.equal(byAddressNear.targetSwap, null, "and so does the address alone");
});
