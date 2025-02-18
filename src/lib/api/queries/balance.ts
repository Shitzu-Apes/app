import { createQueryKeys } from "@lukemorales/query-key-factory";
import { createQuery } from "@tanstack/svelte-query";

import { fetchAccountBalance } from "$lib/near/balance";
import { Ft } from "$lib/near/fungibleToken";

export const balanceKeys = createQueryKeys("balance", {
  ft: (params: { tokenId: string; accountId: string; decimals: number }) => ({
    queryKey: [params],
    queryFn: () =>
      Ft.balanceOf(params.tokenId, params.accountId, params.decimals),
  }),
  account: (accountId: string) => ({
    queryKey: [accountId],
    queryFn: () => fetchAccountBalance(accountId),
  }),
  tokenRegistration: (params: { tokenId: string; accountId: string }) => ({
    queryKey: [params],
    queryFn: () => Ft.isUserRegistered(params.tokenId, params.accountId),
  }),
  tokenStorageRequirement: (tokenId: string) => ({
    queryKey: [tokenId],
    queryFn: () => Ft.storageRequirement(tokenId),
  }),
});

export function useAccountBalanceQuery(accountId: string) {
  return createQuery(balanceKeys.account(accountId));
}

export function useFtBalanceQuery(
  tokenId: string,
  accountId: string,
  decimals: number,
) {
  return createQuery(balanceKeys.ft({ tokenId, accountId, decimals }));
}

export function useTokenRegistrationQuery(tokenId: string, accountId: string) {
  return createQuery({
    ...balanceKeys.tokenRegistration({ tokenId, accountId }),
    enabled: !!tokenId && !!accountId,
  });
}

export function useTokenStorageRequirementQuery(tokenId: string) {
  return createQuery({
    ...balanceKeys.tokenStorageRequirement(tokenId),
    enabled: !!tokenId,
  });
}

// Re-export for use in other queries
export const queries = {
  balance: balanceKeys,
};
