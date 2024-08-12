import {
  HereWallet,
  type SignAndSendTransactionOptions,
  type SignAndSendTransactionsOptions,
} from "@here-wallet/core";
import type {
  BrowserWalletMetadata,
  FinalExecutionOutcome,
  InjectedWalletMetadata,
  ModuleState,
  Wallet as NearWallet,
} from "@near-wallet-selector/core";
import { derived, get, readable, writable } from "svelte/store";
import { P, match } from "ts-pattern";

import { browser } from "$app/environment";
import { addTxToast, addToast } from "$lib/components/memecooking/Toast.svelte";
import type { UnionModuleState, WalletAccount } from "$lib/models";

export type TransactionCallbacks<T> = {
  onSuccess?: (outcome: T | undefined) => Promise<void> | void;
  onError?: () => Promise<void> | void;
  onFinally?: () => Promise<void> | void;
};

export class Wallet {
  private hereWallet?: HereWallet;

  private _isTG = false;
  public get isTG() {
    return this._isTG;
  }

  private selector$ = readable(
    browser
      ? Promise.all([
          import("@near-wallet-selector/core"),
          import("@near-wallet-selector/here-wallet"),
          import("@near-wallet-selector/meteor-wallet"),
          // import("@near-wallet-selector/my-near-wallet"),
        ]).then(
          ([
            { setupWalletSelector },
            { setupHereWallet },
            { setupMeteorWallet },
            // { setupMyNearWallet },
          ]) =>
            setupWalletSelector({
              network: import.meta.env.VITE_NETWORK_ID,
              modules: [
                setupHereWallet(),
                setupMeteorWallet(),
                // setupMyNearWallet(),
              ],
            }),
        )
      : // eslint-disable-next-line @typescript-eslint/no-empty-function
        new Promise<never>(() => {}),
  );

  private _account$ = writable<WalletAccount>();
  public account$ = derived(this._account$, (a) => a);

  public accountId$ = derived(this.account$, (account) => {
    return match(account)
      .with(undefined, () => undefined)
      .with(
        {
          type: "wallet-selector",
          account: P.select(),
        },
        (account) => account.accountId,
      )
      .with(
        {
          type: "here",
          account: P.select(),
        },
        (account) => account,
      )
      .exhaustive();
  });

  public iconUrl$ = derived(this._account$, (account) => {
    return match(account)
      .with(undefined, () => undefined)
      .with(
        {
          type: "wallet-selector",
          account: P.any,
        },
        async () => {
          const selector = await get(this.selector$);
          const wallet = await selector.wallet();
          return wallet.metadata.iconUrl;
        },
      )
      .with(
        {
          type: "here",
          account: P.any,
        },
        async () => {
          return "https://tgapp-dev.herewallet.app/hot-icon.85a5171e.webp";
        },
      )
      .exhaustive();
  });

  public modules$ = derived(this.selector$, async (s) => {
    const selector = await s;
    return selector.store.getState().modules.map((mod): UnionModuleState => {
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
        default:
          throw new Error("unimplemented");
      }
    });
  });

  constructor() {
    HereWallet.connect({
      nodeUrl: import.meta.env.VITE_NODE_URL,
    }).then((hereWallet) => {
      this.hereWallet = hereWallet;
    });

    this.selector$.subscribe(async (s) => {
      const selector = await s;
      const isSignedInWithNear = selector.isSignedIn();
      if (isSignedInWithNear) {
        const account = selector.store
          .getState()
          .accounts.find(({ active }) => active);
        if (!account) return;
        this._account$.set({
          type: "wallet-selector",
          account,
        });
      } else {
        const hereWallet = await this.connectHere();
        const accounts = await hereWallet.getAccounts();
        if (accounts.length > 0) {
          this._isTG = true;
          await this.loginViaHere();
        }
      }
    });

    if (import.meta.env.DEV) {
      this._account$.subscribe((account) => {
        console.info("assign new account:", account);
      });
    }

    this.connectHere = this.connectHere.bind(this);
    this.loginViaWalletSelector = this.loginViaWalletSelector.bind(this);
    this.loginViaHere = this.loginViaHere.bind(this);
    this.signOut = this.signOut.bind(this);
  }

  private connectHere() {
    if (this.hereWallet) return Promise.resolve(this.hereWallet);
    return HereWallet.connect({
      nodeUrl: import.meta.env.VITE_NODE_URL,
    }).then((hereWallet) => {
      this.hereWallet = hereWallet;
      return this.hereWallet;
    });
  }

  public async loginViaWalletSelector(unionMod: UnionModuleState) {
    const mod = unionMod as ModuleState<NearWallet>;
    const wallet = await mod.wallet();

    return match(wallet)
      .with({ type: P.union("browser", "injected") }, async (wallet) => {
        const accounts = await wallet.signIn({
          contractId:
            import.meta.env.VITE_CONNECT_ID ??
            import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
        });
        const account = accounts.pop();
        if (!account) return;
        this._account$.set({
          type: "wallet-selector",
          account,
        });
        addToast({
          data: {
            type: "simple",
            data: {
              title: "Connect",
              description: `Successfully connected Near account ${account.accountId} via ${wallet.metadata.name}`,
            },
          },
        });
      })
      .otherwise(() => {
        throw new Error("unimplemented");
      });
  }

  public async loginViaHere() {
    if (!this.hereWallet) {
      throw new Error("HereWallet not yet initialized");
    }
    const accounts = await this.hereWallet.getAccounts();
    this._account$.set({
      type: "here",
      account: accounts[0],
    });
  }

  public async signOut() {
    return match(get(this._account$))
      .with(undefined, () => undefined)
      .with(
        {
          type: "wallet-selector",
          account: P.select(),
        },
        async (account) => {
          const selector = await get(this.selector$);
          const wallet = await selector.wallet();
          await wallet.signOut();
          addToast({
            data: {
              type: "simple",
              data: {
                title: "Disconnect",
                description: `Disconnected Near account ${account.accountId}`,
              },
            },
          });
          this._account$.set(undefined);
        },
      )
      .with(
        {
          type: "here",
          account: P.select(),
        },
        async (account) => {
          if (!this.hereWallet) {
            throw new Error("HereWallet not yet initialized");
          }
          await this.hereWallet.signOut();
          addToast({
            data: {
              type: "simple",
              data: {
                title: "Disconnect",
                description: `Disconnected Near account ${account}`,
              },
            },
          });
          this._account$.set(undefined);
        },
      )
      .exhaustive();
  }

  public async signAndSendTransactions(
    params: SignAndSendTransactionsOptions,
    {
      onSuccess,
      onError,
      onFinally,
    }: TransactionCallbacks<FinalExecutionOutcome[]>,
  ) {
    const txPromise = match(get(this._account$))
      .with(undefined, () => undefined)
      .with(
        {
          type: "wallet-selector",
          account: P.any,
        },
        async () => {
          const selector = await get(this.selector$);
          const wallet = await selector.wallet();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return wallet.signAndSendTransactions(params as any);
        },
      )
      .with(
        {
          type: "here",
          account: P.any,
        },
        async () => {
          if (!this.hereWallet) {
            throw new Error("HereWallet not yet initialized");
          }
          return this.hereWallet.signAndSendTransactions(params);
        },
      )
      .exhaustive();
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
    params: SignAndSendTransactionOptions,
    {
      onSuccess,
      onError,
      onFinally,
    }: TransactionCallbacks<FinalExecutionOutcome>,
  ) {
    const txPromise = match(get(this._account$))
      .with(undefined, () => undefined)
      .with(
        {
          type: "wallet-selector",
          account: P.any,
        },
        async () => {
          const selector = await get(this.selector$);
          const wallet = await selector.wallet();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return wallet.signAndSendTransaction(params as any);
        },
      )
      .with(
        {
          type: "here",
          account: P.any,
        },
        async () => {
          if (!this.hereWallet) {
            throw new Error("HereWallet not yet initialized");
          }
          return this.hereWallet.signAndSendTransaction(params);
        },
      )
      .exhaustive();
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

export const wallet = new Wallet();

export interface WalletMetadata {
  url: string;
  extensionUrl?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
}

export const NEAR_WALLETS: Record<string, WalletMetadata> = {
  "here-wallet": {
    url: "https://herewallet.app/",
    twitter: "https://twitter.com/here_wallet",
  },
  "meteor-wallet": {
    url: "https://meteorwallet.app/",
    extensionUrl:
      "https://chrome.google.com/webstore/detail/meteor-wallet/pcndjhkinnkaohffealmlmhaepkpmgkb",
    twitter: "https://twitter.com/MeteorWallet",
  },
  // "my-near-wallet": {
  //   url: "https://app.mynearwallet.com/",
  //   twitter: "https://twitter.com/MyNearWallet",
  //   telegram: "https://t.me/mnw_chat",
  // },
};
