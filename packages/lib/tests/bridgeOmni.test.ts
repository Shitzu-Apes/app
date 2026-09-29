import assert from "node:assert/strict";
import test from "node:test";

test("omni client is a singleton and points at the mainnet API", async () => {
  process.env.VITE_NETWORK_ID = "mainnet";
  const { getOmniApi, OMNI_API_BASE_URL } = await import(
    "../src/bridge/omni.ts"
  );

  assert.equal(OMNI_API_BASE_URL, "https://mainnet.api.bridge.nearone.org");
  assert.equal(getOmniApi(), getOmniApi(), "expected one shared instance");
});

test("importing omni switches the SDK's on-chain addresses off mainnet", async () => {
  const { getNetwork, addresses } = await import("omni-bridge-sdk");

  // The bug this guards: the SDK defaults its program/contract addresses to
  // mainnet regardless of the API base URL, so a testnet build would have sent
  // deposits to mainnet contracts.
  process.env.VITE_NETWORK_ID = "testnet";
  await import("../src/bridge/omni.ts?testnet");

  assert.equal(getNetwork(), "testnet");
  // Since 0.21 `addresses.near` is an object, not a bare contract id.
  assert.equal(addresses.near.contract, "omni.n-bridge.testnet");
  assert.equal(
    addresses.sol.locker,
    "862HdJV59Vp83PbcubUnvuXc4EAXP8CDDs6LTxFpunTe",
  );
});

test("mainnet leaves the SDK on mainnet addresses", async () => {
  process.env.VITE_NETWORK_ID = "mainnet";
  await import("../src/bridge/omni.ts?mainnet");

  const { getNetwork, addresses } = await import("omni-bridge-sdk");
  assert.equal(getNetwork(), "mainnet");
  assert.equal(addresses.near.contract, "omni.bridge.near");
});

test("network <-> chain kind maps round-trip", async () => {
  process.env.VITE_NETWORK_ID = "mainnet";
  const { NETWORK_TO_CHAIN_KIND, CHAIN_KIND_TO_NETWORK } = await import(
    "../src/bridge/omni.ts"
  );
  const { ChainKind } = await import("omni-bridge-sdk");
  const { CHAINS } = await import("../src/bridge/chains.ts");

  for (const chain of Object.values(CHAINS)) {
    assert.equal(
      NETWORK_TO_CHAIN_KIND[chain.network],
      chain.kind,
      chain.network,
    );
    assert.equal(
      CHAIN_KIND_TO_NETWORK[chain.kind],
      chain.network,
      chain.network,
    );
  }

  assert.equal(NETWORK_TO_CHAIN_KIND.near, ChainKind.Near);
  assert.equal(NETWORK_TO_CHAIN_KIND.solana, ChainKind.Sol);
  assert.equal(NETWORK_TO_CHAIN_KIND.arbitrum, ChainKind.Arb);
  assert.equal(NETWORK_TO_CHAIN_KIND.ethereum, ChainKind.Eth);
});
