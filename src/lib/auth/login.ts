import { derived, writable, type Writable } from "svelte/store";

import { replaceState } from "$app/navigation";
import { client } from "$lib/api/client";
import { addToast } from "$lib/components/Toast.svelte";

const isLoggedIn: Writable<ReturnType<typeof fetchIsLoggedIn>> = writable(
  new Promise<never>(() => {}),
);
export const isLoggedIn$ = derived(isLoggedIn, (a) => a);

export function webWalletLogin(currentAccountId: string) {
  let signedMessage: {
    accountId: string;
    signature: string;
    publicKey: string;
    callbackUrl: string;
  } | null = null;
  try {
    const url = new URL(window.location.href);
    if (!url.hash) return;
    const accountId = decodeURIComponent(
      url.hash.split("accountId=")[1].split("&")[0],
    );
    const signature = decodeURIComponent(
      url.hash.split("signature=")[1].split("&")[0],
    );
    const publicKey = decodeURIComponent(
      url.hash.split("publicKey=")[1].split("&")[0],
    );
    // TODO enable once Bitte wallet supports `state`
    // const state = decodeURIComponent(url.hash.split("state=")[1].split("&")[0]);
    // const previousState = window.localStorage.getItem("memecooking_state");
    url.hash = "";

    // if (state !== previousState) {
    //   console.error(
    //     `[webWalletLogin] state ${state} != previousState ${previousState}`,
    //   );
    //   replaceState(url.toString(), {});
    //   return;
    // }

    signedMessage = {
      accountId,
      signature,
      publicKey,
      callbackUrl: url.href,
    };

    if (
      currentAccountId == null ||
      signedMessage.accountId !== currentAccountId
    ) {
      replaceState(url.toString(), {});
      return addToast({
        data: {
          type: "simple",
          data: {
            title: "Error",
            description:
              "You can only login with the same account that is currently connected",
            type: "error",
          },
        },
      });
    }

    client
      .GET("/auth/login", {
        params: {
          query: signedMessage,
        },
        credentials: "include",
      })
      .then(() => {
        replaceState(url.toString(), {});
        fetchIsLoggedIn();
      });
  } catch (err) {
    console.error("Error in login process:", err);
  }
}

export function fetchIsLoggedIn(): Promise<boolean | undefined> {
  const res = client
    .GET("/auth/check", {
      credentials: "include",
    })
    .then(({ data }) => data?.isLoggedIn)
    .catch((err) => {
      console.error("[fetchIsLoggedIn]", err);
      return false;
    });
  isLoggedIn.set(res);
  return res;
}
