import { writable } from "svelte/store";
import { wallet } from "./wallet";
import { FixedNumber } from "$lib/util";
import { Ft } from "$lib/near";

export const nearBalance = writable<FixedNumber | null>(null);
export const wrappedNearBalance = writable<FixedNumber | null>(null);

export async function refreshNearBalance(accountId?: string): Promise<void> {
  if (typeof accountId !== "string") {
    nearBalance.set(null);
    return;
  }
  const res = await fetch(import.meta.env.VITE_NODE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "dontcare",
      method: "query",
      params: {
        request_type: "view_account",
        finality: "final",
        account_id: accountId,
      },
    }),
  });
  const json = (await res.json()) as {
    result: { amount: string; locked: string };
  };
  if (json.result) {
    nearBalance.set(
      new FixedNumber(json.result.amount, 24).sub(
        new FixedNumber(json.result.locked, 24),
      ),
    );
  }
}

export async function refreshWrappedNearBalance(accountId?: string): Promise<void> {
  if (typeof accountId !== "string") {
    wrappedNearBalance.set(null);
    return;
  }
  try {
    const decimals = 24;
    const balance = await Ft.balanceOf(import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID, accountId, decimals);
    wrappedNearBalance.set(balance);
  } catch (error) {
    console.error("Error refreshing wNEAR balance:", error);
    wrappedNearBalance.set(null);
  }
}

wallet.accountId$.subscribe((accountId) => {
  if (accountId == null) return;
  refreshNearBalance(accountId);
  refreshWrappedNearBalance(accountId);
});
