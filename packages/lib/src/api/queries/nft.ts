import { createQueryKeys } from "@lukemorales/query-key-factory";
import { createQuery } from "@tanstack/svelte-query";

import { Nft } from "$lib/near";

export const nft = createQueryKeys("nft", {
  supplyForOwner: (accountId: string) => ({
    queryKey: [{ accountId }],
    queryFn: () => Nft.nftSupplyForOwner(accountId),
  }),
  tokensForOwner: (accountId: string) => ({
    queryKey: [{ accountId }],
    queryFn: () => Nft.nftTokensForOwner(accountId),
  }),
  token: (tokenId: string) => ({
    queryKey: [{ tokenId }],
    queryFn: () => Nft.nftToken(tokenId),
  }),
  tokens: (params?: { fromIndex?: string; limit?: number }) => ({
    queryKey: [{ params }],
    queryFn: () =>
      Nft.nftTokens(params?.fromIndex || "0", params?.limit || null),
  }),
});

export function useNftSupplyForOwnerQuery(accountId: string) {
  return createQuery({
    ...nft.supplyForOwner(accountId),
    enabled: !!accountId, // Only run if accountId is provided
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useNftTokensForOwnerQuery(accountId: string) {
  return createQuery({
    ...nft.tokensForOwner(accountId),
    enabled: !!accountId, // Only run if accountId is provided
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useNftTokenQuery(tokenId: string, enabled: boolean = true) {
  return createQuery({
    ...nft.token(tokenId),
    enabled, // Only run if tokenId is provided
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useNftTokensQuery(params?: {
  fromIndex?: string;
  limit?: number;
}) {
  return createQuery({
    ...nft.tokens(params),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
