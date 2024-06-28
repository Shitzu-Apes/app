import { WalletSelector } from ".";

import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
import type { colorVariant } from "$lib/models/variant";

export async function showWalletSelector(variant: colorVariant = "lime") {
  openBottomSheet(WalletSelector, { variant });
}
