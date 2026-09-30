import { get } from "svelte/store";
import { match } from "ts-pattern";

import LazySheet from "$lib/components/LazySheet.svelte";
import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
import type { Network } from "$lib/models/tokens";
import type { colorVariant } from "$lib/models/variant";
import { nearWallet } from "$lib/near";
import { solanaWallet } from "$lib/solana/wallet";

export async function showWalletSelector(
  variant: colorVariant = "lime",
  initialNetwork?: Network,
) {
  // The selector pulls in the EVM/Solana wallet connectors, so it is loaded on
  // click instead of at startup.
  openBottomSheet(LazySheet, {
    loader: () => import("./WalletSelector.svelte"),
    props: {
      variant,
      initialNetwork: match(initialNetwork)
        .with("near", () => "near")
        .with("solana", () => "solana")
        .with("ethereum", () => "evm")
        .with("base", () => "evm")
        .with("arbitrum", () => "evm")
        .with("bnb", () => "evm")
        .with(undefined, () => undefined)
        .exhaustive(),
    },
  });
}

export const ACCEPT_DISCLAIMER_LOCAL_STORAGE_KEY = "accept-disclaimer";

export function acceptWalletDisclaimer() {
  localStorage.setItem(ACCEPT_DISCLAIMER_LOCAL_STORAGE_KEY, "true");
}

export function hasAcceptedWalletDisclaimer() {
  return localStorage.getItem(ACCEPT_DISCLAIMER_LOCAL_STORAGE_KEY) === "true";
}

/**
 * Gate for any action that needs a NEAR account. Returns true when the wallet is
 * already connected, and otherwise opens the selector and returns false so the
 * caller can bail out early.
 *
 * Use this instead of calling `showWalletSelector` inline so every NEAR-requiring
 * action prompts the same way.
 */
export function requireNearWallet(variant: colorVariant = "lime"): boolean {
  if (get(nearWallet.accountId$)) return true;
  showWalletSelector(variant, "near");
  return false;
}

/** Gate for any action that needs a Solana wallet. Same contract as above. */
export function requireSolanaWallet(variant: colorVariant = "lime"): boolean {
  if (get(solanaWallet.publicKey$)) return true;
  showWalletSelector(variant, "solana");
  return false;
}

/**
 * True when the NEAR wallet is missing. Meant for `{#if}` branches so a button
 * can relabel itself to "Connect Wallet" instead of only failing on click.
 */
export function nearWalletConnected(): boolean {
  return Boolean(get(nearWallet.accountId$));
}
