import { AnchorProvider, type Provider } from "@coral-xyz/anchor";
import {
  WalletConnectionError,
  type SignerWalletAdapter,
} from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { clusterApiUrl, Connection, type PublicKey } from "@solana/web3.js";
import { derived, get, writable } from "svelte/store";

import { browser } from "$app/environment"; // For SvelteKit
import { addToast } from "$lib/components/Toast.svelte";

const network =
  import.meta.env.VITE_NETWORK_ID === "mainnet" ? "mainnet-beta" : "devnet";
const isMultichain =
  import.meta.env.VITE_WALLET_SELECTOR_MULTICHAIN === undefined ||
  import.meta.env.VITE_WALLET_SELECTOR_MULTICHAIN !== "false";
const connection = new Connection(
  import.meta.env.VITE_SOLANA_RPC_URL ?? clusterApiUrl(network),
);

export class SolanaWallet {
  private _wallets$ = writable<SignerWalletAdapter[]>([]);
  private _selectedWallet$ = writable<SignerWalletAdapter | undefined>(
    undefined,
  );
  private _publicKey$ = writable<PublicKey | undefined>();
  private _isAutoConnecting$ = writable(false);
  private _provider: Provider | null = null; // Add a provider instance variable

  constructor() {
    const wallets = isMultichain
      ? [new PhantomWalletAdapter(), new SolflareWalletAdapter()]
      : [];
    this._wallets$.set(wallets);

    // Try to auto-connect on initialization
    this.autoConnect();

    // Subscribe to wallet adapter events
    wallets.forEach((wallet) => {
      wallet.on("connect", () => {
        this._selectedWallet$.set(wallet);
        this._publicKey$.set(wallet.publicKey ?? undefined);
        this.updateProvider(); // Update provider on connect
      });

      wallet.on("disconnect", () => {
        const current = get(this._selectedWallet$);
        if (current?.name === wallet.name) {
          this._selectedWallet$.set(undefined);
          this._publicKey$.set(undefined);
          this.updateProvider(); // Update provider on disconnect
        }
      });
    });
  }

  public wallets$ = derived(this._wallets$, (w) => w);
  public selectedWallet$ = derived(this._selectedWallet$, (w) => w);
  public publicKey$ = derived(this._publicKey$, (k) => k);
  public connected$ = derived(
    this._selectedWallet$,
    (w) => w?.connected ?? false,
  );
  public isAutoConnecting$ = derived(this._isAutoConnecting$, (s) => s);

  private async autoConnect() {
    this._isAutoConnecting$.set(true);
    try {
      const wallets = get(this._wallets$);
      for (const wallet of wallets) {
        try {
          await wallet.autoConnect();
          // Don't show toast for auto-connect
          this._selectedWallet$.set(wallet);
          this._publicKey$.set(wallet.publicKey ?? undefined);
          break;
        } catch {
          // Continue to next wallet if this one fails
          continue;
        }
      }
    } catch (error) {
      console.error("Auto-connect failed:", error);
    } finally {
      this._isAutoConnecting$.set(false);
    }
  }

  public async connect(wallet: SignerWalletAdapter) {
    try {
      await wallet.connect();

      if (wallet.publicKey == null) {
        addToast({
          data: {
            type: "simple",
            data: {
              title: "Connection Failed",
              description: "Please unlock your wallet, then try again.",
              type: "error",
            },
          },
        });
        return;
      }

      this._selectedWallet$.set(wallet);
      this._publicKey$.set(wallet.publicKey ?? undefined);
      this.updateProvider();

      console.log("wallet", wallet);

      addToast({
        data: {
          type: "simple",
          data: {
            title: "Connect",
            description: `Successfully connected Solana account ${wallet.publicKey?.toBase58().slice(0, 6)}...${wallet.publicKey?.toBase58().slice(-4)} via ${wallet.name}`,
          },
        },
      });
    } catch (error) {
      console.error("Failed to connect wallet:", error);

      if (error instanceof WalletConnectionError) {
        addToast({
          data: {
            type: "simple",
            data: {
              title: "Connection Failed",
              description: "Please unlock your wallet, then try again.",
              type: "error",
            },
          },
        });
        return;
      }
      addToast({
        data: {
          type: "simple",
          data: {
            title: "Connection Failed",
            description: "Failed to connect Solana wallet. Please try again.",
            type: "error",
          },
        },
      });
      throw error;
    }
  }

  public async disconnect() {
    const wallet = get(this._selectedWallet$);
    const publicKey = get(this._publicKey$);
    if (!wallet) return;

    try {
      await wallet.disconnect();
      addToast({
        data: {
          type: "simple",
          data: {
            title: "Disconnect",
            description: `Disconnected Solana account ${publicKey?.toBase58().slice(0, 6)}...${publicKey?.toBase58().slice(-4)}`,
          },
        },
      });

      this._selectedWallet$.set(undefined);
      this._publicKey$.set(undefined);
      this.updateProvider(); // <--- VERY IMPORTANT
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
      addToast({
        data: {
          type: "simple",
          data: {
            title: "Disconnect Failed",
            description:
              "Failed to disconnect Solana wallet. Please try again.",
            type: "error",
          },
        },
      });
      throw error;
    }
  }

  private updateProvider() {
    if (browser) {
      // Check for browser environment.
      const wallet = get(this._selectedWallet$);
      if (wallet && wallet.publicKey) {
        this._provider = new AnchorProvider(
          connection,
          {
            signTransaction: wallet.signTransaction.bind(wallet),
            signAllTransactions: wallet.signAllTransactions.bind(wallet),
            publicKey: wallet.publicKey,
          },
          AnchorProvider.defaultOptions(),
        );
      } else {
        this._provider = null;
      }
    } else {
      // if not in browser, set to null.
      this._provider = null;
    }
  }

  public getProvider(): Provider | null {
    return this._provider;
  }

  public getConnection() {
    return connection;
  }
  // Remove the getAnchorWallet(), replace with getProvider()
}

export const solanaWallet = new SolanaWallet();
