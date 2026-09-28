import assert from "node:assert/strict";
import test from "node:test";

process.env.VITE_NETWORK_ID = "mainnet";

const { searchRoutes } = await import("../src/lib/bridge/search.ts");
const { SOLANA_LIQUIDITY, canSwapOnSolana } = await import(
  "../src/lib/bridge/rail.ts"
);

// What is restricted is the *rail*, not the token being swapped.
//
// A route that swaps on the Solana side needs that rail to have a pool there, and
// only wNEAR and SHITZU are known to. So those are the only rails a Solana-side swap
// may run through. Gating the target instead — which is what this did first — is
// wrong twice over: it forbids USDC → USDC, which is the deepest pair on Solana and
// the conversion most likely to be wanted, and it does so only after asking the
// router about every rail in the registry.

const registry = {
  NEAR: {
    symbol: "NEAR",
    icon: "",
    decimals: { near: 24, solana: 9 },
    addresses: { near: "wrap.near", solana: "SoW" },
  },
  SHITZU: {
    symbol: "SHITZU",
    icon: "",
    decimals: { near: 18, solana: 9 },
    addresses: {
      near: "token.0xshitzu.near",
      solana: "AFbJW5rdaGidnF6o8ZqTtkDBpq3fotSBdJN8fGRN3VRS",
    },
  },
  OMGY: {
    symbol: "OMGY",
    icon: "",
    decimals: { near: 18, solana: 9 },
    addresses: { near: "omgy.near", solana: "OMGYmint" },
  },
  JAMBO: {
    symbol: "JAMBO",
    icon: "",
    decimals: { near: 18, solana: 9 },
    addresses: { near: "jambo.near", solana: "JAMBOmint" },
  },
  JLU: {
    symbol: "JLU",
    icon: "",
    decimals: { near: 18, solana: 9 },
    addresses: { near: "jlu.near", solana: "JLUmint" },
  },
} as never;

const USDC_NEAR = "usdc.tether-token.near";
const USDC_SOL = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const leg = () => ({
  guaranteedOut: 2_000_000_000_000_000_000_000_000n,
  estimatedOut: 2_500_000_000_000_000_000_000_000n,
  guaranteedOutUsd: 0.9,
  estimatedOutUsd: 0.95,
});

/** Counts what was asked of the router, so "dropped early" is measurable. */
function countingDeps() {
  const asked: string[] = [];
  return {
    asked,
    deps: {
      quoteSourceSwap: async (rail: { tokenId: string }) => {
        asked.push(`source:${rail.tokenId}`);
        return leg();
      },
      quoteTargetSwap: async (rail: { tokenId: string }) => {
        asked.push(`target:${rail.tokenId}`);
        return leg();
      },
      quoteBridgeFee: async () => ({
        tokenFee: 1n,
        nativeFee: 0n,
        usdFee: null,
      }),
      quoteSameChainSwap: async () => {
        asked.push("same-chain");
        return leg();
      },
    },
  };
}

const search = async (input: Record<string, unknown>) => {
  const { asked, deps } = countingDeps();
  const result = await searchRoutes(
    { ...input, registry, amount: 1_000_000_000_000_000_000_000_000n } as never,
    deps as never,
  );
  return { asked, result };
};

test("the Solana whitelist is wNEAR and SHITZU, and nothing else", () => {
  assert.deepEqual([...SOLANA_LIQUIDITY].sort(), ["NEAR", "SHITZU"]);
});

test("a token is matched by registry key or by mint, not by one of them", () => {
  // A Solana wallet knows wNEAR by its mint and never by the registry's key, so
  // matching only the key would reject the one token every NEAR rail arrives as.
  assert.equal(canSwapOnSolana(registry, "NEAR", undefined), true, "by key");
  assert.equal(canSwapOnSolana(registry, "anything", "SoW"), true, "by mint");
  assert.equal(canSwapOnSolana(registry, "OMGY", "OMGYmint"), false);
  assert.equal(canSwapOnSolana(registry, "OMGY", undefined), false);
  assert.equal(
    canSwapOnSolana(registry, "OMGY", ""),
    false,
    "an empty address is no address",
  );
});

test("a mint handed over as the token id counts, with no address alongside", () => {
  // The picker can hand over a token it knows only by its mint, putting it in the id
  // and leaving the address unset. Checking the address field alone would reject
  // wNEAR and SHITZU for every such rail.
  assert.equal(canSwapOnSolana(registry, "SoW", undefined), true);
  assert.equal(
    canSwapOnSolana(
      registry,
      "AFbJW5rdaGidnF6o8ZqTtkDBpq3fotSBdJN8fGRN3VRS",
      undefined,
    ),
    true,
  );
  assert.equal(canSwapOnSolana(registry, "JLUmint", undefined), false);
});

test("USDC on NEAR into USDC on Solana routes, over wNEAR", async () => {
  // The conversion this was all for, and the one the first version of this rule
  // forbade. USDC is not a bridge asset, so both ends need a swap, and the wNEAR rail
  // is the only one that can do it.
  const { result } = await search({
    source: "near",
    dest: "solana",
    sourceTokenId: USDC_NEAR,
    sourceAddress: USDC_NEAR,
    targetTokenId: USDC_SOL,
    targetAddress: USDC_SOL,
  });
  assert.ok(result.plans.length > 0, "and it is not silently empty");
  const overNear = result.plans.find((p) => p.rail.tokenId === "NEAR");
  assert.ok(overNear, "the wNEAR rail is the one that carries it");
  assert.ok(overNear.sourceSwap, "swap USDC into wNEAR on NEAR");
  assert.ok(overNear.targetSwap, "swap wNEAR into USDC on Solana");
});

test("only the Solana-liquid rails are put to the router at all", async () => {
  // The complaint this fixes: every bridgeable token was being asked about, and six
  // of eight answers were going to be rejections. Asking two rails instead of eight is
  // the difference, and it has to be measured on calls rather than asserted.
  const { asked, result } = await search({
    source: "near",
    dest: "solana",
    sourceTokenId: USDC_NEAR,
    sourceAddress: USDC_NEAR,
    targetTokenId: USDC_SOL,
    targetAddress: USDC_SOL,
  });
  assert.deepEqual(
    [...new Set(asked.map((call) => call.split(":")[1]))].sort(),
    ["NEAR", "SHITZU"],
    "the router is only asked about rails that can carry the swap",
  );
  assert.equal(asked.length, 4, "two rails, two legs each");
  assert.equal(
    result.rejected.length,
    3,
    "the other three are dropped without being asked",
  );
  assert.ok(
    result.rejected.every((r) => r.reason === "no-solana-liquidity"),
    "and dropped for the honest reason",
  );
});

test("a bridge asset on both sides is a straight bridge, with no swap anywhere", async () => {
  // Holding SHITZU on NEAR and receiving it on Solana is a direct bridge, so no pool
  // is the question and its own rail is the obvious one.
  const { asked, result } = await search({
    source: "near",
    dest: "solana",
    sourceTokenId: "SHITZU",
    sourceAddress: "token.0xshitzu.near",
    targetTokenId: "SHITZU",
    targetAddress: "AFbJW5rdaGidnF6o8ZqTtkDBpq3fotSBdJN8fGRN3VRS",
  });
  const direct = result.plans.find((p) => p.rail.tokenId === "SHITZU");
  assert.ok(direct, "its own rail bridges it");
  assert.equal(direct.sourceSwap, null);
  assert.equal(direct.targetSwap, null);
  // And a straight bridge asks nothing of any pool, so the wNEAR rail is still
  // allowed to compete as swap → bridge → swap.
  assert.ok(
    asked.includes("source:NEAR"),
    "the alternative is still considered",
  );
});

test("a straight bridge of a token with no Solana liquidity is still allowed", async () => {
  // OMGY is a bridge asset on both chains, so bridging it needs no pool on either
  // side. The rule restricts rails that must be *swapped*, and this one is not.
  const { result } = await search({
    source: "near",
    dest: "solana",
    sourceTokenId: "OMGY",
    sourceAddress: "omgy.near",
    targetTokenId: "OMGY",
    targetAddress: "OMGYmint",
  });
  const direct = result.plans.find((p) => p.rail.tokenId === "OMGY");
  assert.ok(direct, "the native bridge path must survive the rule");
  assert.equal(direct.sourceSwap, null);
  assert.equal(direct.targetSwap, null);
});

test("a Solana source that must be swapped is restricted the same way", async () => {
  // The mirror: spending a Solana token the registry has no key for, so every rail
  // needs a source swap on Solana and only two rails can carry it.
  const { asked, result } = await search({
    source: "solana",
    dest: "near",
    sourceTokenId: "So11111111111111111111111111111111111111112",
    sourceAddress: "So11111111111111111111111111111111111111112",
    targetTokenId: "NEAR",
  });
  assert.deepEqual(
    [...new Set(asked.map((call) => call.split(":")[1]))].sort(),
    ["NEAR", "SHITZU"],
  );
  assert.ok(result.plans.length > 0, "and it still routes");
});

test("the NEAR side is not restricted at all", async () => {
  // OMGY has no Solana liquidity at all, and the reason a same-chain NEAR conversion
  // is allowed is to reach it. Restricting the NEAR side on the same reasoning would
  // delete that feature — and this rule is explicitly about the Solana side.
  const { asked, result } = await search({
    source: "near",
    dest: "near",
    sourceTokenId: "OMGY",
    sourceAddress: "omgy.near",
    targetTokenId: "NEAR",
  });
  assert.ok(result.plans.length > 0, "NEAR is not restricted");
  assert.ok(asked.length > 0, "and it is quoted, not assumed");
});
