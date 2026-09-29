import { writable } from "svelte/store";

import { rpcFetch, RpcResponseError } from "./rpc-retry";
import { nearWallet } from "./wallet";

import { FixedNumber } from "$lib/util";

export const nearBalance = writable<FixedNumber | null>(null);

export async function fetchAccountBalance(
  accountId: string,
): Promise<{ amount: string; locked: string } | null> {
  try {
    return await rpcFetch<{ amount: string; locked: string }>(
      import.meta.env.VITE_NODE_URL,
      {
        method: "query",
        params: {
          request_type: "view_account",
          finality: "final",
          account_id: accountId,
        },
      },
    );
  } catch (error: unknown) {
    if (error instanceof RpcResponseError) {
      return null;
    }
    throw error;
  }
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
