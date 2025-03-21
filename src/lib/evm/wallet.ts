import { walletConnect, injected } from "@tarnadas/wagmi-connectors";
import type { GetAccountReturnType, Transport } from "@wagmi/core";
import {
  http,
  createConfig,
  getAccount,
  watchAccount,
  reconnect,
  disconnect as _disconnect,
  switchChain as _switchChain,
  connect as _connect,
  type Connector,
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
  [397]: http(),
  [398]: http(),
};

const near = {
  id: 397,
  name: "Near Protocol",
  nativeCurrency: { name: "NEAR", symbol: "NEAR", decimals: 18 },
  rpcUrls: { default: { http: ["https://eth-rpc.mainnet.near.org"] } },
  blockExplorers: {
    default: { name: "NEAR Explorer", url: "https://eth-explorer.near.org" },
  },
};
const nearTestnet = {
  id: 398,
  name: "Near Protocol Testnet",
  nativeCurrency: { name: "NEAR", symbol: "NEAR", decimals: 18 },
  rpcUrls: { default: { http: ["https://eth-rpc.testnet.near.org"] } },
  blockExplorers: {
    default: {
      name: "NEAR Explorer",
      url: "https://eth-explorer-testnet.near.org",
    },
  },
  testnet: true,
};

export const wagmiConfig = browser
  ? createConfig({
      chains:
        import.meta.env.VITE_NETWORK_ID === "mainnet"
          ? [arbitrum, base, mainnet, near]
          : [arbitrumSepolia, baseSepolia, sepolia, nearTestnet],
      transports,
      connectors: [
        walletConnect({
          projectId:
            import.meta.env.VITE_WC_PROJECT_ID ??
            "dba65fff73650d32ae5157f3492c379e",
          metadata: {
            name: import.meta.env.VITE_APP_NAME ?? "Shitzu App",
            url: window.location.hostname,
            icons: [
              import.meta.env.VITE_APP_LOGO ??
                "https://raw.githubusercontent.com/Shitzu-Apes/brand-kit/main/logo/shitzu.webp",
            ],
            description: import.meta.env.VITE_APP_NAME ?? "Shitzu App",
          },
          showQrModal: true,
        }),
        injected({ shimDisconnect: true }),
      ],
    })
  : (undefined as unknown as ReturnType<typeof createConfig>);
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

export const evmWallet$ = writable(getAccount(wagmiConfig));

// Watch for account changes
if (browser) {
  watchAccount(wagmiConfig, {
    onChange: (account) => {
      evmWallet$.set(account);
    },
  });
  reconnect(wagmiConfig);
}

/**
 * Request wallet to switch to EVM chain
 */
export function switchToChain(chainId: ConfiguredChainId) {
  return _switchChain(wagmiConfig, { chainId });
}

/**
 * Disconnect the user's wallet
 */
export function disconnect() {
  _disconnect(wagmiConfig);
  addToast({
    data: {
      type: "simple",
      data: { title: "Disconnect", description: "Disconnected EVM wallet" },
    },
  });
}

/**
 * Connect to a wallet
 */
export async function connect(
  connector: Connector,
): Promise<GetAccountReturnType> {
  try {
    await _connect(wagmiConfig, { connector });
    const account = getAccount(wagmiConfig);
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
    }
    return account;
  } catch (error) {
    console.error("Failed to connect EVM wallet:", error);
    throw error;
  }
}
