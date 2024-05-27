import { bind } from "svelte-simple-modal";

import { WalletSelector } from ".";

import { modal$, modalSize$, ModalSize } from "$lib/layout";

export async function showWalletSelector() {
  modalSize$.set(ModalSize.Medium);
  modal$.set(bind(WalletSelector, {}));
}
