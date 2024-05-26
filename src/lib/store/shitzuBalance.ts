import { view } from "$lib/near/utils";
import { FixedNumber } from "@tarnadas/fixed-number";
import { writable } from "svelte/store";

export const shitzuBalance = writable<FixedNumber | null>(null);

export async function refreshShitzuBalance(accountId?: string): Promise<void> {
  if (typeof accountId !== "string") {
    shitzuBalance.set(null);
    return;
  }

  const balance = await view("token.0xshitzu.near", "ft_balance_of", {
    account_id: accountId,
  });

  shitzuBalance.set(new FixedNumber(balance, 18));
}
