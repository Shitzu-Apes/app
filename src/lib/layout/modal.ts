import type { SvelteComponent } from "svelte";
import { get, writable } from "svelte/store";

import { ScreenSize, type ModalDimension } from "../models";
import { screenSize$ } from "../screen-size";

import { browser } from "$app/environment";

export enum ModalSize {
  Small,
  Medium,
  Large,
}

export const MODAL_DIMENSIONS = {
  [ModalSize.Small]: () => {
    switch (get(screenSize$)) {
      case ScreenSize.Phone:
        return {
          width: `${400 / 16}rem`,
          maxHeight: "100vh",
        };
      case ScreenSize.Mobile:
        return {
          width: `${400 / 16}rem`,
          maxHeight: "80vh",
        };
      default:
        return {
          width: `${400 / 16}rem`,
          maxHeight: "60vh",
        };
    }
  },
  [ModalSize.Medium]: () => {
    switch (get(screenSize$)) {
      case ScreenSize.Phone:
        return {
          width: `${600 / 16}rem`,
          maxHeight: "100vh",
        };
      case ScreenSize.Mobile:
        return {
          width: `${600 / 16}rem`,
          maxHeight: "85vh",
        };
      default:
        return {
          width: `${600 / 16}rem`,
          maxHeight: "70vh",
        };
    }
  },
  [ModalSize.Large]: () => {
    switch (get(screenSize$)) {
      case ScreenSize.Phone:
        return {
          width: `${800 / 16}rem`,
          maxHeight: "100vh",
        };
      case ScreenSize.Mobile:
        return {
          width: `${800 / 16}rem`,
          maxHeight: "90vh",
        };
      default:
        return {
          width: `${800 / 16}rem`,
          maxHeight: "80vh",
        };
    }
  },
} satisfies Record<ModalSize, () => ModalDimension>;

export const modal$ = writable<typeof SvelteComponent | null>(null);
export const modalCanClose$ = writable<boolean>(true);
export const modalSize$ = writable<ModalSize>(ModalSize.Medium);

modalSize$.subscribe((modalSize) => {
  if (!browser) return;
  setModalDimension(modalSize);
});

screenSize$.subscribe(() => {
  if (!browser) return;
  setModalDimension(get(modalSize$));
});

function setModalDimension(modalSize: ModalSize) {
  const root = document.querySelector(":root") as HTMLElement;
  root.style.setProperty("--modal-width", MODAL_DIMENSIONS[modalSize]().width);
  root.style.setProperty(
    "--modal-max-height",
    MODAL_DIMENSIONS[modalSize]().maxHeight,
  );
}
