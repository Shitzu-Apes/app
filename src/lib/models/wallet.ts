import type {
  Account,
  BrowserWalletMetadata,
  InjectedWalletMetadata,
} from "@near-wallet-selector/core";

export type WalletAccount =
  | {
      type: "wallet-selector";
      account: Account;
    }
  | {
      type: "here";
      account: string;
    }
  | undefined;

// needed to fix types into discriminated union for Svelte template
interface BaseWallet {
  id: string;
}
interface BrowserWallet extends BaseWallet {
  type: "browser";
  metadata: BrowserWalletMetadata;
}
interface InjectedWallet extends BaseWallet {
  type: "injected";
  metadata: InjectedWalletMetadata;
}

export type UnionModuleState = BrowserWallet | InjectedWallet;
