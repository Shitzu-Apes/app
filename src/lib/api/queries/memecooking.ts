import { createQuery } from "@tanstack/svelte-query";

import { fetchMcAccount } from "$lib/near/memecooking";

export const memecookingKeys = {
  all: () => ["memecooking"] as const,
  account: (accountId: string, blockHeight?: number) =>
    [...memecookingKeys.all(), "account", { accountId, blockHeight }] as const,
} as const;

export function useMcAccountQuery(accountId: string, blockHeight?: number) {
  return createQuery({
    queryKey: memecookingKeys.account(accountId, blockHeight),
    queryFn: () => fetchMcAccount(accountId, blockHeight),
    enabled: !!accountId,
  });
}
