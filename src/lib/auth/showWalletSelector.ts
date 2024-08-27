import { WalletSelector } from ".";

import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
import type { colorVariant } from "$lib/models/variant";

export async function showWalletSelector(variant: colorVariant = "lime") {
  openBottomSheet(WalletSelector, { variant });
}

export const ACCEPT_DISCLAIMER_LOCAL_STORAGE_KEY = "accept-disclaimer";

export function acceptWalletDisclaimer() {
  localStorage.setItem(ACCEPT_DISCLAIMER_LOCAL_STORAGE_KEY, "true");
}

export function hasAcceptedWalletDisclaimer() {
  return localStorage.getItem(ACCEPT_DISCLAIMER_LOCAL_STORAGE_KEY) === "true";
}
