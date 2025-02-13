import type { GetAccountReturnType, Transport } from "@wagmi/core";
import {
  http,
  createConfig,
  getAccount,
  watchAccount,
  reconnect,
  disconnect as _disconnect,
  switchChain as _switchChain,
  injected,
} from "@wagmi/core";
import {
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  mainnet,
  sepolia,
} from "@wagmi/core/chains";
import { writable } from "svelte/store";

import { browser } from "$app/environment";
import { addToast } from "$lib/components/Toast.svelte";

export type ConfiguredChain =
  | typeof base
  | typeof baseSepolia
  | typeof arbitrum
  | typeof arbitrumSepolia
  | typeof mainnet
  | typeof sepolia;
export type ConfiguredChainId = ConfiguredChain["id"];

// Initialize chain-specific transports
const transports: Record<number, Transport> = {
  [base.id]: http(),
  [baseSepolia.id]: http(),
  [arbitrum.id]: http(),
  [arbitrumSepolia.id]: http(),
  [mainnet.id]: http(),
  [sepolia.id]: http(),
};

// Create wagmi config
export const config = createConfig({
  chains:
    import.meta.env.VITE_NETWORK_ID === "mainnet"
      ? [arbitrum, base, mainnet]
      : [arbitrumSepolia, baseSepolia, sepolia],
  connectors: [injected()],
  transports,
});
export const baseConfig = createConfig({
  chains:
    import.meta.env.VITE_NETWORK_ID === "mainnet" ? [base] : [baseSepolia],
  connectors: [injected()],
  transports,
});
export const arbitrumConfig = createConfig({
  chains:
    import.meta.env.VITE_NETWORK_ID === "mainnet"
      ? [arbitrum]
      : [arbitrumSepolia],
  connectors: [injected()],
  transports,
});
export const mainnetConfig = createConfig({
  chains: import.meta.env.VITE_NETWORK_ID === "mainnet" ? [mainnet] : [sepolia],
  connectors: [injected()],
  transports,
});

// Create and export a readable wallet store
export type Wallet = GetAccountReturnType;
export type ConnectedWallet = Wallet & { status: "connected" };

export const evmWallet$ = writable(getAccount(config));

// Watch for account changes
if (browser) {
  watchAccount(config, {
    onChange: (account) => {
      evmWallet$.set(account);
      if (account.status === "connected") {
        addToast({
          data: {
            type: "simple",
            data: {
              title: "Connect",
              description: `Successfully connected EVM account ${account.address.slice(0, 6)}...${account.address.slice(-4)}`,
            },
          },
        });
      } else if (account.status === "disconnected") {
        addToast({
          data: {
            type: "simple",
            data: {
              title: "Disconnect",
              description: "Disconnected EVM wallet",
            },
          },
        });
      }
    },
  });
  reconnect(config);
}

/**
 * Request wallet to switch to EVM chain
 */
export function switchToChain(chainId: ConfiguredChainId) {
  return _switchChain(config, {
    chainId,
  });
}

/**
 * Disconnect the user's wallet
 */
export function disconnect() {
  _disconnect(config);
}
