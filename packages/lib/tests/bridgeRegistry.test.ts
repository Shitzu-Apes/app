import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  railCandidates,
  targetCandidates,
  type Registry,
} from "../src/bridge/rail.ts";

/**
 * The registry is verified as data rather than as an import.
 *
 * `src/bridge/tokens.ts` also owns every balance store and reaches the
 * wallet modules, which read `import.meta.env` at module scope and cannot be
 * loaded outside a SvelteKit build. So the addresses are read out of the source
 * and fed to the real routing rules. That keeps the assertions honest about the
 * thing that actually matters — which tokens can carry which rail — while
 * `bridgeRail.test.ts` covers the rules themselves against a fixture.
 *
 * The parse is deliberately narrow: only the `addresses` block, whose lines are
 * short and uniformly formatted. The base64 icon lines are never touched, which
 * is the point — they are the reason this file exists instead of a plain import.
 */
function readRegistryAddresses(): Registry {
  const source = readFileSync("src/bridge/tokens.ts", "utf8");
  const registry: Registry = {};

  // Each top-level token entry starts at two-space indentation.
  const entries = source.split(/\n {2}([A-Z0-9]+): \{\n/).slice(1);
  for (let i = 0; i < entries.length; i += 2) {
    const tokenId = entries[i];
    const body = entries[i + 1];

    const block = body.match(/\n {4}addresses: \{\n([\s\S]*?)\n {4}\},/);
    if (!block) continue;

    const addresses: Record<string, string | undefined> = {};
    for (const line of block[1].split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//")) continue;
      const match = trimmed.match(/^(\w+):\s*(.*?),?$/);
      if (!match) continue;
      const [, network, raw] = match;
      if (raw === "undefined") {
        addresses[network] = undefined;
      } else if (raw.startsWith('"')) {
        addresses[network] = raw.slice(1, -1);
      } else if (raw.startsWith("import.meta.env.")) {
        // Only the wrap.near contract id is configured rather than literal.
        addresses[network] = "wrap.near";
      }
    }
    registry[tokenId] = {
      symbol: tokenId,
      icon: "",
      decimals: {},
      addresses: addresses as Registry[string]["addresses"],
    };
  }
  return registry;
}

const registry = readRegistryAddresses();

test("the registry is read back completely", () => {
  // If the parse ever stops matching, every assertion below would pass
  // vacuously on an empty registry, so check the shape first.
  assert.deepEqual(Object.keys(registry).sort(), [
    "CYPH",
    "JAMBO",
    "JLU",
    "NEAR",
    "OMGY",
    "POPPY",
    "PURGE",
    "SHITZU",
    "XAUT",
  ]);
});

test("every registry token has an explicit address for all six networks", () => {
  // The rules only look at the two networks in play. A missing key would read as
  // "not on this chain" by accident rather than by decision.
  for (const [tokenId, entry] of Object.entries(registry)) {
    for (const network of [
      "near",
      "solana",
      "base",
      "arbitrum",
      "ethereum",
      "bnb",
    ]) {
      assert.ok(network in entry.addresses, `${tokenId} has no ${network} key`);
    }
  }
});

test("eight tokens can carry a NEAR <-> Solana bridge", () => {
  // Verified against the live aggregators: every one of these has a route on at
  // least one direction. XAUT is the exclusion, being NEAR and Ethereum only.
  // CYPH is the omni bridge's own Solana-native token (burn-and-mint), carried
  // by the same rail shape; both directions verified live on mainnet.
  assert.deepEqual(
    railCandidates(registry, "near", "solana").map((r) => r.tokenId),
    ["NEAR", "SHITZU", "OMGY", "JAMBO", "JLU", "PURGE", "POPPY", "CYPH"],
  );
});

test("wNEAR leads the rails, and it is the deepest pool on both chains", () => {
  assert.equal(railCandidates(registry, "near", "solana")[0].tokenId, "NEAR");
});

test("no NEAR address carries a prefix the aggregator would reject", () => {
  for (const [tokenId, entry] of Object.entries(registry)) {
    const address = entry.addresses.near;
    if (!address) continue;
    assert.ok(!address.startsWith("nep141:"), `${tokenId} has a nep141 prefix`);
    assert.ok(
      !address.startsWith("rhea-nep141:"),
      `${tokenId} has an rhea prefix`,
    );
  }
});

test("Solana targets exclude XAUT, NEAR targets include it", () => {
  const solana = targetCandidates(registry, "solana").map((t) => t.tokenId);
  const near = targetCandidates(registry, "near").map((t) => t.tokenId);
  assert.ok(!solana.includes("XAUT"));
  assert.ok(near.includes("XAUT"));
  assert.equal(solana.length, 8);
  assert.equal(near.length, 9);
});

test("POPPY's NEAR contract is named for testnet but is the mainnet token", () => {
  // `poppy-0.meme-cooking-test.near` looks like a mistake and has been left
  // alone. It routes on mainnet, so the name is historical, not a bug. Asserted
  // so a future cleanup does not silently swap a working rail for a dead one.
  assert.equal(registry.POPPY.addresses.near, "poppy-0.meme-cooking-test.near");
});
