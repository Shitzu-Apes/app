import { Ft } from "$lib/near";
import { FixedNumber } from "@tarnadas/fixed-number";
import { writable } from "svelte/store";

export const shitzuBalance = writable<Promise<FixedNumber>>(
  new Promise(() => {}),
);

export async function refreshShitzuBalance(accountId?: string): Promise<void> {
  if (typeof accountId !== "string") {
    shitzuBalance.set(Promise.reject(new Error("Invalid accountId")));
    return;
  }

  const balance = Ft.balanceOf("token.0xshitzu.near", accountId, 18);

  shitzuBalance.set(balance);
}
