import { writable } from "svelte/store";

import { nearWallet } from "./wallet";

import { FixedNumber } from "$lib/util";

export const nearBalance = writable<FixedNumber | null>(null);

export async function fetchAccountBalance(
  accountId: string,
): Promise<{ amount: string; locked: string } | null> {
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
  return json.result || null;
}

export async function refreshNearBalance(accountId?: string): Promise<void> {
  if (typeof accountId !== "string") {
    nearBalance.set(null);
    return;
  }

  const result = await fetchAccountBalance(accountId);

  if (result) {
    nearBalance.set(
      new FixedNumber(result.amount, 24).sub(
        new FixedNumber(result.locked, 24),
      ),
    );
  }
}

nearWallet.accountId$.subscribe((accountId) => {
  if (accountId == null) return;
  refreshNearBalance(accountId);
});
