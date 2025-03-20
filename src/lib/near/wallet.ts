import type {
  Account,
  BrowserWallet,
  BrowserWalletMetadata,
  FinalExecutionOutcome,
  InjectedWalletMetadata,
  ModuleState,
  Wallet as NearWallet,
  SignedMessage,
} from "@near-wallet-selector/core";
import { injected, walletConnect } from "@tarnadas/wagmi-connectors";
import { createConfig, http } from "@wagmi/core";
import type { SvelteComponent } from "svelte";
import { derived, get, readable, writable } from "svelte/store";
import { P, match } from "ts-pattern";

import { browser } from "$app/environment";
import { client } from "$lib/api/client";
import { fetchMyFlags } from "$lib/auth/flag";
import { fetchIsLoggedIn, webWalletLogin } from "$lib/auth/login";
import { addToast, addTxToast } from "$lib/components/Toast.svelte";
import EvmOnboardSheet from "$lib/components/memecooking/BottomSheet/EvmOnboardSheet.svelte";
import type { UnionModuleState } from "$lib/models";

export type TransactionCallbacks<T> = {
  onSuccess?: (outcome: T | undefined) => Promise<void> | void;
  onError?: () => Promise<void> | void;
  onFinally?: () => Promise<void> | void;
};

async function fetchAccountDetail() {
  // TODO MC check. If not => don't fetch flag
  return Promise.all([fetchIsLoggedIn(), fetchMyFlags()]);
}

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
        import.meta.env.VITE_NETWORK_ID === "mainnet" ? [near] : [nearTestnet],
      transports: { [397]: http(), [398]: http() },
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
          showQrModal: false,
        }),
        injected({ shimDisconnect: true }),
      ],
    })
  : (undefined as unknown as ReturnType<typeof createConfig>);

export class Wallet {
  public selector$ = readable(
    browser
      ? Promise.all([
          import("@near-wallet-selector/core"),
          import("@near-wallet-selector/meteor-wallet"),
          import("@near-wallet-selector/here-wallet"),
          import("@near-wallet-selector/bitte-wallet"),
          import("@near-wallet-selector/near-mobile-wallet"),
          import("@near-wallet-selector/okx-wallet"),
          import("@near-wallet-selector/my-near-wallet"),
          import("@near-wallet-selector/wallet-connect"),
          import("@near-wallet-selector/ethereum-wallets"),
          // import("@web3modal/wagmi"),
          import("@keypom/one-click-connect"),
        ]).then(
          ([
            { setupWalletSelector },
            { setupMeteorWallet },
            { setupHereWallet },
            { setupBitteWallet },
            { setupNearMobileWallet },
            { setupOKXWallet },
            { setupMyNearWallet },
            { setupWalletConnect },
            { setupEthereumWallets },
            // { createWeb3Modal },
            { setupOneClickConnect },
          ]) => {
            this.isLoading$.set(false);
            return setupWalletSelector({
              network: import.meta.env.VITE_NETWORK_ID,
              modules: [
                setupMeteorWallet(),
                setupHereWallet(),
                setupBitteWallet(),
                setupNearMobileWallet({
                  dAppMetadata: {
                    name: import.meta.env.VITE_APP_NAME ?? "Shitzu App",
                    logoUrl:
                      import.meta.env.VITE_APP_LOGO ??
                      "https://raw.githubusercontent.com/Shitzu-Apes/brand-kit/main/logo/shitzu.webp",
                  },
                }),
                setupOKXWallet(),
                setupMyNearWallet(),
                setupWalletConnect({
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
                }),
                setupEthereumWallets({
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  wagmiConfig: wagmiConfig as any,
                  // web3Modal: createWeb3Modal({
                  //   wagmiConfig,
                  //   projectId:
                  //     import.meta.env.VITE_WC_PROJECT_ID ??
                  //     "dba65fff73650d32ae5157f3492c379e",
                  //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  // }) as any,
                }),
                setupOneClickConnect({
                  contractId: import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
                  networkId: import.meta.env.VITE_NETWORK_ID,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                }) as any,
              ],
            });
          },
        )
      : // eslint-disable-next-line @typescript-eslint/no-empty-function
        new Promise<never>(() => {}),
  );

  public isLoading$ = writable(true);

  private _account$ = writable<Account | undefined>();
  public account$ = derived(this._account$, (a) => a);

  public accountId$ = derived(this.account$, (account) => {
    return account?.accountId;
  });

  public walletName$ = derived(this._account$, async () => {
    const selector = await get(this.selector$);
    const wallet = await selector.wallet();
    return wallet.metadata.name;
  });

  public walletId$ = derived(this._account$, async () => {
    const selector = await get(this.selector$);
    const wallet = await selector.wallet();
    console.log("[wallet]", wallet);
    return wallet.id;
  });

  public iconUrl$ = derived(this._account$, async (account) => {
    if (!account) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((account as any).walletId === "sweat-wallet") {
      return "https://sweateconomy.com/icon-main-color.72b79a87.png";
    }
    const selector = await get(this.selector$);
    const wallet = await selector.wallet();
    return wallet.metadata.iconUrl;
  });

  public modules$ = derived(this.selector$, async (s) => {
    const selector = await s;
    return selector.store
      .getState()
      .modules.map((mod): UnionModuleState | undefined => {
        switch (mod.type) {
          case "injected":
            return {
              ...mod,
              type: "injected",
              metadata: mod.metadata as InjectedWalletMetadata,
            };
          case "browser":
            return {
              ...mod,
              type: "browser",
              metadata: mod.metadata as BrowserWalletMetadata,
            };
          case "bridge":
            return {
              ...mod,
              type: "bridge",
              metadata: mod.metadata as BrowserWalletMetadata,
            };
          case "instant-link":
            return;
          default:
            throw new Error(`unimplemented: ${mod.type}`);
        }
      })
      .filter((mod) => mod != null);
  });

  constructor() {
    this.selector$.subscribe(async (s) => {
      const selector = await s;
      const isSignedInWithNear = selector.isSignedIn();
      if (isSignedInWithNear) {
        const account = selector.store
          .getState()
          .accounts.find(({ active }) => active);
        if (!account) return;
        this._account$.set(account);
      }
    });

    if (import.meta.env.DEV) {
      this._account$.subscribe((account) => {
        console.info("assign new account:", account);
      });
    }

    this.loginViaWalletSelector = this.loginViaWalletSelector.bind(this);
    this.signOut = this.signOut.bind(this);
    this.login = this.login.bind(this);
  }

  public async login() {
    const selector = await get(this.selector$);
    const wallet = await selector.wallet();
    if (!wallet) return;

    const response = await client.GET("/auth/get_nonce", {
      credentials: "include",
    });

    if (!response.data?.nonce) {
      return addToast({
        data: {
          type: "simple",
          data: {
            title: "Error",
            description: "Failed to get nonce",
            type: "error",
          },
        },
      });
    }
    const nonce = Buffer.from(response.data?.nonce, "hex");
    // TODO enable once Bitte wallet supports `state`
    // const state = window.crypto.randomUUID().split("-")[0];
    // window.localStorage.setItem("memecooking_state", state);
    const message = {
      message: "Login to Meme Cooking",
      nonce,
      recipient: import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
      // state,
    };
    const signedMessage = (await wallet.signMessage(message)) as SignedMessage;
    const accountId = await get(this.accountId$);
    if (accountId == null || signedMessage.accountId !== accountId) {
      return addToast({
        data: {
          type: "simple",
          data: {
            title: "Error",
            description:
              "You can only login with the same account that is currently connected",
            type: "error",
          },
        },
      });
    }

    return client
      .GET("/auth/login", {
        params: { query: signedMessage },
        credentials: "include",
      })
      .then(fetchAccountDetail);
  }

  public async loginViaWalletSelector(unionMod: UnionModuleState) {
    const mod = unionMod as ModuleState<NearWallet>;
    const wallet = await mod.wallet();

    return match(wallet)
      .with(
        { type: P.union("browser", "injected", "bridge") },
        async (wallet) => {
          // FIXME optional access key not yet supported by wallet selector
          const contractId = match(wallet.id)
            .with(
              P.union("meteor-wallet", "ethereum-wallets"),
              () => undefined as unknown as string,
            )
            .otherwise(() => import.meta.env.VITE_CONTRACT_ID);
          const accounts = await wallet.signIn({ contractId });
          const account = accounts.pop();
          if (!account) return;
          this._account$.set(account);
          addToast({
            data: {
              type: "simple",
              data: {
                title: "Connect",
                description: `Successfully connected Near account ${account.accountId.length > 24 ? `${account.accountId.substring(0, 6)}...${account.accountId.slice(-4)}` : account.accountId} via ${wallet.metadata.name}`,
              },
            },
          });
        },
      )
      .otherwise(() => {
        throw new Error("unimplemented");
      });
  }

  public async signOut() {
    const account = get(this._account$);
    if (!account) return;
    const selector = await get(this.selector$);
    const wallet = await selector.wallet();
    await wallet.signOut();
    addToast({
      data: {
        type: "simple",
        data: {
          title: "Disconnect",
          description: `Disconnected Near account ${account.accountId.length > 24 ? `${account.accountId.substring(0, 6)}...${account.accountId.slice(-4)}` : account.accountId}`,
        },
      },
    });
    this._account$.set(undefined);
  }

  public async signAndSendTransactions(
    params: Parameters<BrowserWallet["signAndSendTransactions"]>[0],
    {
      onSuccess,
      onError,
      onFinally,
    }: TransactionCallbacks<FinalExecutionOutcome[]>,
  ) {
    const selector = await get(this.selector$);
    const wallet = await selector.wallet();
    const txPromise = wallet.signAndSendTransactions(params);
    if (!txPromise) return;
    addTxToast(txPromise);
    return txPromise
      .then((outcome) => {
        if (onSuccess) {
          onSuccess(outcome || undefined);
        }
      })
      .catch(onError)
      .finally(onFinally);
  }

  public async signAndSendTransaction(
    params: Parameters<BrowserWallet["signAndSendTransaction"]>[0],
    {
      onSuccess,
      onError,
      onFinally,
    }: TransactionCallbacks<FinalExecutionOutcome>,
  ) {
    const selector = await get(this.selector$);
    const wallet = await selector.wallet();
    const txPromise = wallet.signAndSendTransaction(params);
    if (!txPromise) return;
    addTxToast(txPromise);
    return txPromise
      .then((outcome) => {
        if (onSuccess) {
          onSuccess(outcome || undefined);
        }
      })
      .catch(onError)
      .finally(onFinally);
  }
}

export const nearWallet = new Wallet();

if (browser) {
  nearWallet.accountId$.subscribe((accountId) => {
    if (accountId == null) return;
    webWalletLogin(accountId);
    fetchAccountDetail();
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface WalletMetadata<T extends SvelteComponent = any> {
  url?: string;
  extensionUrl?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
  name?: string;
  infoSheet?: T;
}

export const NEAR_WALLETS: Record<string, WalletMetadata> = {
  "meteor-wallet": {
    url: "https://meteorwallet.app/",
    twitter: "https://x.com/MeteorWallet",
  },
  "here-wallet": {
    url: "https://herewallet.app/",
    twitter: "https://x.com/here_wallet",
  },
  "bitte-wallet": {
    url: "https://bitte.ai/",
    twitter: "https://x.com/BitteProtocol",
    telegram: "https://t.me/mintdev",
  },
  "near-mobile-wallet": {
    url: "https://nearmobile.app/",
    twitter: "https://x.com/NEARMobile_app",
    telegram: "https://t.me/NEARMobile",
  },
  "okx-wallet": {
    url: "https://okx.com/web3",
    twitter: "https://x.com/okxweb3",
  },
  "my-near-wallet": {
    url: "https://app.mynearwallet.com/",
    twitter: "https://twitter.com/MyNearWallet",
    telegram: "https://t.me/mnw_chat",
  },
  "wallet-connect": { name: "WalletConnect (Near)" },
  "ethereum-wallets": { infoSheet: EvmOnboardSheet },
  "sweat-wallet": {},
};
