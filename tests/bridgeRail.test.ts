import assert from "node:assert/strict";
import test from "node:test";

import {
  findRail,
  railCandidates,
  targetCandidates,
  type Registry,
} from "../src/lib/bridge/rail.ts";

/**
 * A stand-in with the same shape as the real registry, including the awkward
 * parts: a token on only one chain, a token with a `nep141:`-style prefix, and
 * decimals that differ per network.
 */
const registry: Registry = {
  NEAR: {
    symbol: "NEAR",
    icon: "/wnear.webp",
    decimals: { near: 24, solana: 9, base: 18 },
    addresses: { near: "wrap.near", solana: "3ZLek", base: undefined },
  },
  SHITZU: {
    symbol: "SHITZU",
    icon: "/shitzu.webp",
    decimals: { near: 18, solana: 9, base: 18 },
    addresses: {
      near: "token.0xshitzu.near",
      solana: "AFbJW5",
      base: undefined,
    },
  },
  PURGE: {
    symbol: "PURGE",
    icon: "/purge.webp",
    decimals: { near: 18, solana: 9, base: undefined },
    addresses: { near: "purge-558.meme-cooking.near", solana: "GqcYoM" },
  },
  // NEAR and Ethereum only: the case that must not become a rail.
  XAUT: {
    symbol: "XAUt",
    icon: "/xaut.webp",
    decimals: { near: 6, solana: undefined, ethereum: 6 },
    addresses: {
      near: "68749665ff8d2d112fa859aa293f07a622782f38.factory.bridge.near",
      solana: undefined,
      ethereum: "0x68749665FF8D2d112Fa859AA293F07A622782F38",
    },
  },
};

const ids = (source: "near" | "solana", dest: "near" | "solana") =>
  railCandidates(registry, source, dest).map((r) => r.tokenId);

test("a rail needs an address on both ends", () => {
  assert.deepEqual(ids("near", "solana"), ["NEAR", "SHITZU", "PURGE"]);
});

test("XAUT is not a NEAR/Solana rail, because it has no Solana address", () => {
  // It is on NEAR and Ethereum, so it looks bridgeable until you check both ends.
  assert.equal(findRail(registry, "near", "solana", "XAUT"), undefined);
  assert.ok(!ids("near", "solana").includes("XAUT"));
});

test("the rail set does not depend on which end is the source", () => {
  assert.deepEqual(ids("near", "solana"), ids("solana", "near"));
});

test("the registry's own order is preserved, so wNEAR leads", () => {
  // The search falls back to the deepest pool when nothing better routes, and
  // ties have to break the same way every time or the UI reshuffles on refresh.
  assert.equal(railCandidates(registry, "near", "solana")[0].tokenId, "NEAR");
});

test("a network cannot be bridged to itself", () => {
  assert.deepEqual(railCandidates(registry, "near", "near"), []);
});

test("a rail carries both addresses and both decimal counts", () => {
  const shitzu = findRail(registry, "near", "solana", "SHITZU");
  assert.ok(shitzu);
  assert.equal(shitzu!.sourceAddress, "token.0xshitzu.near");
  assert.equal(shitzu!.sourceDecimals, 18);
  assert.equal(shitzu!.destDecimals, 9);
  assert.equal(
    findRail(registry, "solana", "near", "SHITZU")!.sourceAddress,
    "AFbJW5",
  );
});

test("NEAR addresses arrive ready for the aggregator", () => {
  // A `nep141:`-prefixed id returns an empty route list for every pair, so a
  // rail that leaked one would look like a token with no pool.
  const prefixed: Registry = {
    WEIRD: {
      symbol: "WEIRD",
      icon: "/x.webp",
      decimals: { near: 18, solana: 9 },
      addresses: { near: "nep141:weird.near", solana: "Mint111" },
    },
  };
  const [rail] = railCandidates(prefixed, "near", "solana");
  assert.equal(rail.sourceAddress, "weird.near");
});

test("Solana addresses are left exactly as the registry has them", () => {
  // SPL mints are base58: case matters and no prefix is valid.
  assert.equal(
    findRail(registry, "solana", "near", "NEAR")!.sourceAddress,
    "3ZLek",
  );
});

test("the target picker offers what is actually on that network", () => {
  assert.deepEqual(
    targetCandidates(registry, "solana").map((t) => t.tokenId),
    ["NEAR", "SHITZU", "PURGE"],
  );
  assert.ok(
    targetCandidates(registry, "near").some((t) => t.tokenId === "XAUT"),
  );
  assert.ok(
    !targetCandidates(registry, "solana").some((t) => t.tokenId === "XAUT"),
  );
});

test("the target picker includes the token the user already holds", () => {
  // Bridging a token unchanged is the native flow. It has to be reachable from
  // the same picker or the native path becomes a separate journey.
  const solana = targetCandidates(registry, "solana").map((t) => t.tokenId);
  for (const tokenId of ["NEAR", "SHITZU", "PURGE"]) {
    assert.ok(solana.includes(tokenId), `${tokenId} missing`);
  }
});

test("targets carry the decimals of the network they sit on", () => {
  // The same token is 24 decimals on NEAR and 9 on Solana, which is why an
  // amount cannot be reused across the bridge and has to be re-based per leg.
  assert.equal(
    targetCandidates(registry, "near").find((t) => t.tokenId === "NEAR")
      ?.decimals,
    24,
  );
  assert.equal(
    targetCandidates(registry, "solana").find((t) => t.tokenId === "NEAR")
      ?.decimals,
    9,
  );
});

test("a missing decimals entry falls back rather than producing NaN", () => {
  const sparse: Registry = {
    ODD: {
      symbol: "ODD",
      icon: "/x.webp",
      // Listed on both chains but never given decimals.
      decimals: {},
      addresses: { near: "odd.near", solana: "MintOdd" },
    },
  };
  const [rail] = railCandidates(sparse, "near", "solana");
  assert.equal(rail.sourceDecimals, 18);
  assert.equal(rail.destDecimals, 18);
});

test("an empty registry yields no rails and no targets", () => {
  assert.deepEqual(railCandidates({}, "near", "solana"), []);
  assert.deepEqual(targetCandidates({}, "near"), []);
});
