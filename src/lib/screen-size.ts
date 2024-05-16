import { derived, writable } from "svelte/store";

import { ScreenSize } from "./models";

export const screenSize$ = writable<ScreenSize>(ScreenSize.Laptop);

export const widthAtMost$ = (width: ScreenSize) =>
  derived(screenSize$, (screenSize) => {
    return width >= screenSize;
  });

export const widthAtLeast$ = (width: ScreenSize) =>
  derived(screenSize$, (screenSize) => {
    return width <= screenSize;
  });
