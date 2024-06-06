import { WalletSelector } from ".";

import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";

export async function showWalletSelector() {
  openBottomSheet(WalletSelector);
}
