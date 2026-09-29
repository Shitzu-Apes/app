import { createQueryKeys } from "@lukemorales/query-key-factory";
import { createQuery } from "@tanstack/svelte-query";

import { Ft } from "$lib/near";

const queryKeys = createQueryKeys("shitzuBalance", {
  balance: (accountId: string) => ({
    queryKey: [accountId],
    queryFn: () => Ft.balanceOf("token.0xshitzu.near", accountId, 18),
  }),
});

export function useShitzuBalanceQuery(accountId: string) {
  return createQuery({
    ...queryKeys.balance(accountId),
    enabled: !!accountId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
