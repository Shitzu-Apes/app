import type { FinalExecutionOutcome } from "@near-wallet-selector/core";
import type Snackbar from "@smui/snackbar";
import { derived, get, writable, type Writable } from "svelte/store";

import { TxSnackbar } from "$lib/components";

export type SnackbarComponent = (
  | { type: "text"; text: string }
  | {
      type: "component";
      component: ConstructorOfATypedSvelteComponent;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      props: Record<string, any> & {
        setClass?: (className: string) => void;
      };
      destroyed$: Writable<boolean>;
    }
) & { class$: Writable<string>; canClose$: Writable<boolean>; timeout: number };

const snackbarComponents$ = writable<SnackbarComponent[]>([]);
const waiting$ = writable(false);
const triggerUpdate$ = writable(0);
let waitingTimer: number | null = null;
let destroyTimer: number | undefined;

export const snackbar$ = writable<Snackbar>();
const _snackbarComponent$ = derived(
  [snackbarComponents$, waiting$, triggerUpdate$],
  ([components, waiting]) => {
    if (components.length === 0) {
      return;
    }
    if (waiting) {
      if (!waitingTimer) {
        waitingTimer = setTimeout(() => {
          waiting$.set(false);
          waitingTimer = null;
        }, 100) as unknown as number;
      }
      return;
    }
    let component = components[0] as SnackbarComponent | undefined;
    let shouldUpdate = false;
    while (
      component &&
      component.type === "component" &&
      get(component.destroyed$)
    ) {
      components.shift();
      component = components[0] as SnackbarComponent | undefined;
      shouldUpdate = true;
    }
    if (shouldUpdate) {
      snackbarComponents$.set([...components]);
    }
    return component;
  },
);
export const snackbarComponent$ = derived(
  [snackbar$, _snackbarComponent$],
  ([snackbar, component]) => {
    if (component) {
      if (!snackbar.isOpen()) {
        snackbar.open();
      }
    } else {
      try {
        if (snackbar.isOpen()) {
          snackbar.close();
          waiting$.set(true);
        }
      } catch {
        // ignore
      }
    }
    return component;
  },
);

export function showSnackbar(text: string) {
  pushComponent({
    type: "text",
    text,
    class$: writable(""),
    canClose$: writable(true),
    timeout: 7_000,
  });
}

export function showTxSnackbar(
  txPromise: Promise<void | FinalExecutionOutcome | FinalExecutionOutcome[]>,
) {
  const class$ = writable("");
  const canClose$ = writable(false);
  const destroyed$ = writable(false);
  txPromise.finally(() => {
    canClose$.set(true);
    if (!destroyTimer) {
      destroyTimer = setTimeout(() => {
        destroyed$.set(true);
        waiting$.set(true);
        triggerUpdate$.update((val) => val + 1);
        destroyTimer = undefined;
      }, 10_000) as unknown as number;
    }
  });
  pushComponent({
    type: "component",
    component: TxSnackbar,
    props: {
      txPromise,
      setClass: (c) => {
        class$.set(c);
      },
    },
    class$,
    canClose$,
    timeout: -1,
    destroyed$,
  });
}

function pushComponent(component: SnackbarComponent) {
  snackbarComponents$.update((components) => [...components, component]);
}

export function handleCloseSnackbar() {
  const components = get(snackbarComponents$);
  components.shift();
  snackbarComponents$.set([...components]);
  waiting$.set(true);
  if (destroyTimer) {
    clearTimeout(destroyTimer);
  }
  destroyTimer = undefined;
}
