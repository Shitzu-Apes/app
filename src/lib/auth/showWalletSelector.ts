import { match } from "ts-pattern";

import { WalletSelector } from ".";

import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
import type { Network } from "$lib/models/tokens";
import type { colorVariant } from "$lib/models/variant";

export async function showWalletSelector(
  variant: colorVariant = "lime",
  initialNetwork?: Network,
) {
  openBottomSheet(WalletSelector, {
    variant,
    initialNetwork: match(initialNetwork)
      .with("near", () => "near")
      .with("solana", () => "solana")
      .with("ethereum", () => "evm")
      .with("base", () => "evm")
      .with("arbitrum", () => "evm")
      .with(undefined, () => undefined)
      .exhaustive(),
  });
}

export const ACCEPT_DISCLAIMER_LOCAL_STORAGE_KEY = "accept-disclaimer";

export function acceptWalletDisclaimer() {
  localStorage.setItem(ACCEPT_DISCLAIMER_LOCAL_STORAGE_KEY, "true");
}

export function hasAcceptedWalletDisclaimer() {
  return localStorage.getItem(ACCEPT_DISCLAIMER_LOCAL_STORAGE_KEY) === "true";
}
