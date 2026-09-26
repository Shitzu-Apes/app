import { ChainKind, type Chain } from "omni-bridge-sdk";

import type { Network } from "$lib/models/tokens";

export type BridgeChain = {
  /** App-level network id, as used by the `Network` type. */
  network: Network;
  /** Chain id used by the Omni Bridge API and SDK receipts. */
  chain: Chain;
  kind: ChainKind;
  name: string;
  /** Short label for dense UI such as the token selector row. */
  shortName: string;
  icon: string;
  nativeSymbol: string;
  nativeDecimals: number;
  /** Path segment this chain's explorer uses for addresses. */
  explorerAddressPath: string;
  /** Path segment this chain's explorer uses for transactions. */
  explorerTxPath: string;
  /**
   * Explorer host per network. Resolved at call time rather than at module load
   * so the registry stays importable outside Vite (tests, scripts).
   */
  explorerHost: { mainnet: string; testnet: string };
};

function isMainnet(): boolean {
  // `import.meta.env` is Vite-only; fall back to process.env so this module
  // stays importable from plain node (tests, scripts).
  const id =
    import.meta.env?.VITE_NETWORK_ID ?? process.env.VITE_NETWORK_ID ?? "";
  return id === "mainnet";
}

function explorerHost(chain: BridgeChain): string {
  return isMainnet() ? chain.explorerHost.mainnet : chain.explorerHost.testnet;
}

/**
 * Single source of truth for every chain the bridge knows about. Replaces the
 * four separate network/icon/explorer tables that previously lived in the
 * bridge page, TransferStatus, and TokenInfo.
 */
export const CHAINS: Record<Network, BridgeChain> = {
  near: {
    network: "near",
    chain: "Near",
    kind: ChainKind.Near,
    name: "Near",
    shortName: "NEAR",
    icon: "/near-logo.webp",
    nativeSymbol: "NEAR",
    nativeDecimals: 24,
    explorerAddressPath: "address",
    explorerTxPath: "txns",
    explorerHost: {
      mainnet: "nearblocks.io",
      testnet: "testnet.nearblocks.io",
    },
  },
  solana: {
    network: "solana",
    chain: "Sol",
    kind: ChainKind.Sol,
    name: "Solana",
    shortName: "Solana",
    icon: "/sol-logo.webp",
    nativeSymbol: "SOL",
    nativeDecimals: 9,
    explorerAddressPath: "account",
    explorerTxPath: "tx",
    explorerHost: { mainnet: "solscan.io", testnet: "solscan.io" },
  },
  base: {
    network: "base",
    chain: "Base",
    kind: ChainKind.Base,
    name: "Base",
    shortName: "Base",
    icon: "/base-logo.webp",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    explorerAddressPath: "address",
    explorerTxPath: "tx",
    explorerHost: { mainnet: "basescan.org", testnet: "sepolia.basescan.org" },
  },
  arbitrum: {
    network: "arbitrum",
    chain: "Arb",
    kind: ChainKind.Arb,
    name: "Arbitrum",
    shortName: "Arbitrum",
    icon: "/arb-logo.webp",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    explorerAddressPath: "address",
    explorerTxPath: "tx",
    explorerHost: { mainnet: "arbiscan.io", testnet: "sepolia.arbiscan.io" },
  },
  ethereum: {
    network: "ethereum",
    chain: "Eth",
    kind: ChainKind.Eth,
    name: "Ethereum",
    shortName: "Ethereum",
    icon: "/evm-logo.svg",
    nativeSymbol: "ETH",
    nativeDecimals: 18,
    explorerAddressPath: "address",
    explorerTxPath: "tx",
    explorerHost: { mainnet: "etherscan.io", testnet: "sepolia.etherscan.io" },
  },
  bnb: {
    network: "bnb",
    chain: "Bnb",
    kind: ChainKind.Bnb,
    name: "BNB Chain",
    shortName: "BNB",
    icon: "/bnb-logo.svg",
    nativeSymbol: "BNB",
    nativeDecimals: 18,
    explorerAddressPath: "address",
    explorerTxPath: "tx",
    explorerHost: { mainnet: "bscscan.com", testnet: "testnet.bscscan.com" },
  },
};

/** Networks that carry a bridged token, in display order. */
export const BRIDGE_NETWORKS = Object.keys(CHAINS) as Network[];

/**
 * Keyed by lowercased id, because the same chain arrives spelled several ways:
 * the SDK and API receipts say `Sol`, while a `"chain:address"` prefix from a
 * transfer message says `sol`. Matching case-sensitively meant every prefix
 * form missed the registry and fell through to the Ethereum icon, and made
 * explorer links come back empty.
 */
const NETWORK_BY_CHAIN = new Map<string, BridgeChain>(
  Object.values(CHAINS).map((c) => [c.chain.toLowerCase(), c]),
);

/**
 * Resolve an Omni Bridge chain id (`Sol`, `sol`, `Arb`, ...) to its chain
 * definition. Returns undefined for unknown ids instead of throwing, so a new
 * chain on the API side cannot break rendering.
 */
export function getChainByChainId(chainId: string): BridgeChain | undefined {
  if (!chainId) return undefined;
  return NETWORK_BY_CHAIN.get(chainId.toLowerCase());
}

/** Resolve a chain from a `"chain:address"` prefix used by receipts/logs. */
export function getChainByOmniAddress(
  address: string,
): BridgeChain | undefined {
  const [prefix] = address.split(":");
  return prefix ? getChainByChainId(prefix) : undefined;
}

/**
 * Chain icon, falling back to the EVM mark.
 *
 * The fallback is only reached for a chain this build does not know about, which
 * is rare now that lookup is case-insensitive. It is still worth knowing that it
 * is the EVM logo: it is how a Solana transfer came to be drawn as an Ethereum
 * one. There is no neutral chain asset in `static/`, so rather than point at a
 * file that does not exist, an unknown chain is flagged in the console and the
 * caller decides what to render.
 */
export function getChainIcon(chainId: string): string {
  const chain = getChainByChainId(chainId);
  if (!chain) {
    console.warn(
      `No icon for chain "${chainId}"; falling back to the EVM mark.`,
    );
  }
  return chain?.icon ?? "/evm-logo.svg";
}

export function getExplorerUrl(
  chainId: string,
  address: string,
  type: "address" | "tx" = "address",
): string {
  const chain = getChainByChainId(chainId);
  if (!chain) return "";
  const segment =
    type === "address" ? chain.explorerAddressPath : chain.explorerTxPath;
  return `https://${explorerHost(chain)}/${segment}/${address}`;
}
