import { OmniBridgeAPI, setNetwork } from "omni-bridge-sdk";

import { CHAINS } from "./chains";

const networkId =
  (import.meta.env?.VITE_NETWORK_ID ??
    process.env.VITE_NETWORK_ID ??
    "mainnet") === "mainnet"
    ? "mainnet"
    : "testnet";

/**
 * The SDK keeps its on-chain addresses (lockers, the NEAR bridge contract, the
 * Wormhole program) in module-global state that defaults to mainnet. Without
 * this call only the API base URL was env-switched, so a testnet build would
 * still send deposits to mainnet program ids.
 */
setNetwork(networkId);

export const OMNI_API_BASE_URL =
  networkId === "mainnet"
    ? "https://mainnet.api.bridge.nearone.org"
    : "https://testnet.api.bridge.nearone.org";

let api: OmniBridgeAPI | undefined;

/** Shared Omni Bridge API client. */
export function getOmniApi(): OmniBridgeAPI {
  api ??= new OmniBridgeAPI({ baseUrl: OMNI_API_BASE_URL });
  return api;
}

export { networkId as OMNI_NETWORK };

/** App `Network` -> Omni Bridge SDK `ChainKind`. */
export const NETWORK_TO_CHAIN_KIND = Object.fromEntries(
  Object.values(CHAINS).map((c) => [c.network, c.kind]),
) as Record<keyof typeof CHAINS, (typeof CHAINS)[keyof typeof CHAINS]["kind"]>;

/** Omni Bridge SDK `ChainKind` -> app `Network`. */
export const CHAIN_KIND_TO_NETWORK = Object.fromEntries(
  Object.values(CHAINS).map((c) => [c.kind, c.network]),
) as Record<(typeof CHAINS)[keyof typeof CHAINS]["kind"], keyof typeof CHAINS>;
