import { WalletSelector } from ".";

import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";

export async function showWalletSelector(
  variant: "shitzu" | "funmeme" = "shitzu",
) {
  openBottomSheet(WalletSelector, { variant });
}
