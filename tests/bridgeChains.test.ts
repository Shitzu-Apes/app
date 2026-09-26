import assert from "node:assert/strict";
import test from "node:test";

// The mainnet expectations below mirror the pre-extraction tables.
process.env.VITE_NETWORK_ID = "mainnet";

const {
  CHAINS,
  getChainByChainId,
  getChainByOmniAddress,
  getChainIcon,
  getExplorerUrl,
} = await import("../src/lib/bridge/chains.ts");

// Verbatim copies of the tables that existed before extraction
// (src/routes/(shitzu)/bridge/TransferStatus.svelte, mainnet branch).
const origIcon = (chain: string) =>
  ({
    near: "/near-logo.webp",
    sol: "/sol-logo.webp",
    base: "/base-logo.webp",
    arb: "/arb-logo.webp",
    eth: "/evm-logo.svg",
    bnb: "/bnb-logo.svg",
  })[chain];

const origExplorer = (
  chain: string,
  address: string,
  type: "address" | "tx",
) => {
  const seg = type === "address" ? "address" : "tx";
  switch (chain) {
    case "near":
      return `https://nearblocks.io/${type === "address" ? "address" : "txns"}/${address}`;
    case "sol":
      return `https://solscan.io/${type === "address" ? "account" : "tx"}/${address}`;
    case "base":
      return `https://basescan.org/${seg}/${address}`;
    case "arb":
      return `https://arbiscan.io/${seg}/${address}`;
    case "eth":
      return `https://etherscan.io/${seg}/${address}`;
    case "bnb":
      return `https://bscscan.com/${seg}/${address}`;
    default:
      throw new Error(`unknown chain ${chain}`);
  }
};

const ADDRESS = "0xdeadbeef";

test("registry icons match the pre-extraction table", () => {
  for (const chain of Object.values(CHAINS)) {
    const id = chain.chain.toLowerCase();
    assert.equal(getChainIcon(chain.chain), origIcon(id), chain.chain);
  }
});

test("registry explorer URLs match the pre-extraction table", () => {
  for (const chain of Object.values(CHAINS)) {
    const id = chain.chain.toLowerCase();
    assert.equal(
      getExplorerUrl(chain.chain, ADDRESS, "address"),
      origExplorer(id, ADDRESS, "address"),
      `${chain.chain} address`,
    );
    assert.equal(
      getExplorerUrl(chain.chain, ADDRESS, "tx"),
      origExplorer(id, ADDRESS, "tx"),
      `${chain.chain} tx`,
    );
  }
});

test("near uses the txns segment, not tx", () => {
  assert.equal(
    getExplorerUrl("Near", ADDRESS, "tx"),
    `https://nearblocks.io/txns/${ADDRESS}`,
  );
});

test("unknown chain ids degrade instead of throwing", () => {
  assert.equal(getChainIcon("dogecoin"), "/evm-logo.svg");
  assert.equal(getExplorerUrl("dogecoin", ADDRESS), "");
});

// --- case: receipts spell chains two different ways ------------------------

test("chain lookup ignores case", () => {
  // The registry is keyed by the Omni id (`Sol`), but a transfer message
  // carries a lowercased `chain:address` prefix (`sol:9yDC…`). Matching
  // case-sensitively meant the prefix form missed the registry entirely, so a
  // Solana transfer drew the Ethereum icon and its explorer link came back
  // empty.
  for (const chain of Object.values(CHAINS)) {
    for (const spelling of [
      chain.chain,
      chain.chain.toLowerCase(),
      chain.chain.toUpperCase(),
    ]) {
      assert.equal(getChainIcon(spelling), chain.icon, `icon for ${spelling}`);
      assert.equal(
        getChainByChainId(spelling)?.network,
        chain.network,
        `network for ${spelling}`,
      );
    }
  }
});

test("a real receipt's from and to resolve to the right chains", () => {
  // Verbatim from a completed transfer: origin_chain "Sol", sender "sol:…",
  // recipient "near:…".
  const sender = "9yDCicRqNmtUEX3z2krBiZ6GaYQba6NRFrLtcVBXozcT";
  assert.equal(getChainIcon("sol"), "/sol-logo.webp");
  assert.equal(getChainIcon("near"), "/near-logo.webp");
  assert.equal(getChainByOmniAddress(`sol:${sender}`)?.network, "solana");
  assert.equal(getChainByOmniAddress("near:marior.near")?.network, "near");
  assert.equal(
    getExplorerUrl("sol", sender),
    `https://solscan.io/account/${sender}`,
  );
  assert.equal(
    getExplorerUrl("near", "marior.near"),
    "https://nearblocks.io/address/marior.near",
  );
});

test("a lowercase prefix no longer falls back to the EVM mark", () => {
  // The old fallback made this failure invisible: every unresolved chain drew
  // the Ethereum logo. Ethereum itself is excluded because that asset is its
  // registered icon, not a fallback.
  for (const chain of Object.values(CHAINS)) {
    if (chain.network === "ethereum") continue;
    assert.notEqual(
      getChainIcon(chain.chain.toLowerCase()),
      "/evm-logo.svg",
      `${chain.name} must not fall back to the EVM mark`,
    );
  }
});

test("an empty chain id is undefined rather than a lookup hit", () => {
  assert.equal(getChainByChainId(""), undefined);
  assert.equal(getChainByOmniAddress("no-colon-here"), undefined);
});

test("testnet resolves the testnet explorer hosts", async () => {
  process.env.VITE_NETWORK_ID = "testnet";
  const { getExplorerUrl: testnetUrl } = await import(
    "../src/lib/bridge/chains.ts?testnet"
  );
  assert.equal(
    testnetUrl("Near", ADDRESS),
    `https://testnet.nearblocks.io/address/${ADDRESS}`,
  );
  assert.equal(
    testnetUrl("Eth", ADDRESS),
    `https://sepolia.etherscan.io/address/${ADDRESS}`,
  );
  // solscan has no testnet variant
  assert.equal(
    testnetUrl("Sol", ADDRESS),
    `https://solscan.io/account/${ADDRESS}`,
  );
  process.env.VITE_NETWORK_ID = "mainnet";
});
