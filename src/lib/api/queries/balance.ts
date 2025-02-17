import { createQuery } from "@tanstack/svelte-query";

import { fetchAccountBalance } from "$lib/near/balance";

export const balanceKeys = {
  all: () => ["balance"] as const,
  account: (accountId: string) => [...balanceKeys.all(), accountId] as const,
} as const;

export function useAccountBalanceQuery(accountId: string) {
  return createQuery({
    queryKey: balanceKeys.account(accountId),
    queryFn: () => fetchAccountBalance(accountId),
    enabled: !!accountId,
  });
}
