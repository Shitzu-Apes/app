import { AnchorProvider } from "@coral-xyz/anchor";
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

const WALLET_CONNECTED_KEY = "solana-wallet-previously-connected";
const network =
  import.meta.env.VITE_NETWORK_ID === "mainnet" ? "mainnet-beta" : "devnet";
const isMultichain =
  import.meta.env.VITE_WALLET_SELECTOR_MULTICHAIN === undefined ||
  import.meta.env.VITE_WALLET_SELECTOR_MULTICHAIN !== "false";
// Default to the public cluster RPC. An override is still honoured for
// deployments that need a keyed endpoint, but nothing has to be configured.
const connection = new Connection(
  import.meta.env.VITE_SOLANA_RPC_URL || clusterApiUrl(network),
);

export class SolanaWallet {
  private _wallets$ = writable<SignerWalletAdapter[]>([]);
  private _selectedWallet$ = writable<SignerWalletAdapter | undefined>(
    undefined,
  );
  private _publicKey$ = writable<PublicKey | undefined>();
  private _isAutoConnecting$ = writable(false);
  private _provider: AnchorProvider | null = null;

  constructor() {
    const wallets = isMultichain
      ? [new PhantomWalletAdapter(), new SolflareWalletAdapter()]
      : [];
    this._wallets$.set(wallets);

    // Only try to auto-connect if we're in the browser and there was a previous connection
    if (browser && localStorage.getItem(WALLET_CONNECTED_KEY)) {
      this.autoConnect();
    }

    // Subscribe to wallet adapter events
    wallets.forEach((wallet) => {
      wallet.on("connect", () => {
        this.applyWallet(wallet);
      });

      wallet.on("disconnect", () => {
        const current = get(this._selectedWallet$);
        if (current?.name === wallet.name) {
          this.applyWallet(undefined);
        }
      });
    });
  }

  /**
   * The only place that records the connected wallet.
   *
   * `publicKey$` and the provider have to move together: a connected wallet
   * with a null provider looks fine in the UI (address, balances) but fails at
   * signing time, which is what the bridge hit after an auto-connect. Routing
   * every mutation through here makes that split impossible.
   */
  private applyWallet(wallet: SignerWalletAdapter | undefined) {
    this._selectedWallet$.set(wallet);
    this._publicKey$.set(wallet?.publicKey ?? undefined);
    this.updateProvider();
  }

  public wallets$ = derived(this._wallets$, (w) => w);
  public selectedWallet$ = derived(this._selectedWallet$, (w) => w);
  public publicKey$ = derived(this._publicKey$, (k) => k);
  /**
   * Derived from our own public key rather than the adapter's `connected`
   * field, so this can never disagree with what the rest of the app treats as
   * connected. The wallet selector gates its disconnect UI on this, so a
   * divergence here would leave a connected Solana wallet with no way out.
   */
  public connected$ = derived(this._publicKey$, (k) => k != null);
  public isAutoConnecting$ = derived(this._isAutoConnecting$, (s) => s);

  private async autoConnect() {
    this._isAutoConnecting$.set(true);
    try {
      const wallets = get(this._wallets$);
      for (const wallet of wallets) {
        try {
          await wallet.autoConnect();
          // Don't show toast for auto-connect
          this.applyWallet(wallet);
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

      this.applyWallet(wallet);

      // Store successful connection in localStorage
      if (browser) {
        localStorage.setItem(WALLET_CONNECTED_KEY, "true");
      }

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

      // Remove the connected flag from localStorage
      if (browser) {
        localStorage.removeItem(WALLET_CONNECTED_KEY);
      }

      addToast({
        data: {
          type: "simple",
          data: {
            title: "Disconnect",
            description: `Disconnected Solana account ${publicKey?.toBase58().slice(0, 6)}...${publicKey?.toBase58().slice(-4)}`,
          },
        },
      });

      this.applyWallet(undefined);
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

  public getProvider(): AnchorProvider | null {
    return this._provider;
  }

  public getConnection() {
    return connection;
  }
  // Remove the getAnchorWallet(), replace with getProvider()
}

export const solanaWallet = new SolanaWallet();
