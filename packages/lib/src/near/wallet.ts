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

export class Wallet {
  public selector$ = readable(
    browser
      ? Promise.all([
          import("@near-wallet-selector/core"),
          import("@near-wallet-selector/intear-wallet"),
          import("@near-wallet-selector/meteor-wallet"),
          import("@near-wallet-selector/hot-wallet"),
          import("@near-wallet-selector/near-mobile-wallet"),
          import("@near-wallet-selector/okx-wallet"),
          import("@near-wallet-selector/wallet-connect"),
          import("@near-wallet-selector/ethereum-wallets"),
          import("@web3modal/wagmi"),
        ]).then(
          async ([
            { setupWalletSelector },
            { setupIntearWallet },
            { setupMeteorWallet },
            { setupHotWallet },
            { setupNearMobileWallet },
            { setupOKXWallet },
            { setupWalletConnect },
            { setupEthereumWallets },
            { createWeb3Modal },
          ]) => {
            this.isLoading$.set(false);
            // Loaded on demand: the wagmi config drags in the whole EVM stack.
            const { wagmiConfig } = await import("$lib/evm/wallet");
            return setupWalletSelector({
              network: import.meta.env.VITE_NETWORK_ID,
              modules: [
                // Intear's cross-tab logout check is a third-party call to
                // logout-bridge-service.intear.tech with no timeout. It runs
                // while the wallet is being restored on every page load, inside
                // core's setupStorage -> resolveStorageState -> validateWallet
                // -> getWallet -> setupInstance -> IntearWallet chain, which
                // setupWalletSelector awaits. When that host is unreachable the
                // fetch never settles, so setupWalletSelector never resolves,
                // the module list never arrives, and the NEAR tab stays empty
                // forever for anyone who has ever connected Intear. The service
                // was down entirely (every request timed out), which is what
                // triggered it.
                //
                // Pointing it at a same-origin path makes the call fail
                // instantly; Intear treats a non-OK response as "still signed
                // in" and restores the session, so only the cross-tab logout
                // detection is lost. The failure is silent because core only
                // logs it when `debug` is set, which we do not set.
                //
                // Remove this argument to restore cross-tab logout once the
                // upstream service is reliable again. It has to stay absolute:
                // Intear also derives a websocket URL from this value, and
                // `new WebSocket` throws on a relative one, which would surface
                // as an unhandled rejection.
                setupIntearWallet({
                  logoutBridgeService: `${window.location.origin}/logout-bridge-disabled`,
                }),
                setupMeteorWallet(),
                setupHotWallet(),
                setupNearMobileWallet({
                  dAppMetadata: {
                    name: import.meta.env.VITE_APP_NAME ?? "Shitzu App",
                    logoUrl:
                      import.meta.env.VITE_APP_LOGO ??
                      "https://raw.githubusercontent.com/Shitzu-Apes/brand-kit/main/logo/shitzu.webp",
                  },
                }),
                setupOKXWallet(),
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
                  methods: [
                    "near_signIn",
                    "near_signOut",
                    "near_getAccounts",
                    "near_signTransaction",
                    "near_signTransactions",
                    "near_verifyOwner",
                  ],
                }),
                setupEthereumWallets({
                  wagmiConfig,
                  web3Modal: createWeb3Modal({
                    wagmiConfig,
                    projectId:
                      import.meta.env.VITE_WC_PROJECT_ID ??
                      "dba65fff73650d32ae5157f3492c379e",
                  }),
                }),
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

      selector.subscribeOnAccountChange((account) => {
        if (!account) {
          this._account$.set(undefined);
        }
      });
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
              P.union("meteor-wallet", "ethereum-wallets", "intear-wallet"),
              () => undefined as unknown as string,
            )
            .otherwise(() => import.meta.env.VITE_CONNECT_ID);
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
  recommended?: boolean;
  infoSheet?: T;
}

export const NEAR_WALLETS: Record<string, WalletMetadata> = {
  "intear-wallet": {
    url: "https://wallet.intear.tech/",
    twitter: "https://x.com/intea_rs",
    telegram: "https://t.me/intearchat",
    recommended: true,
  },
  "meteor-wallet": {
    url: "https://meteorwallet.app/",
    twitter: "https://x.com/MeteorWallet",
    recommended: true,
  },
  "hot-wallet": {
    url: "https://hot-labs.org/",
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
  "wallet-connect": { name: "WalletConnect (Near)" },
  "ethereum-wallets": { infoSheet: EvmOnboardSheet },
  "sweat-wallet": {},
};
