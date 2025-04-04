import { createQueryKeys } from "@lukemorales/query-key-factory";
import { createQuery, createQueries } from "@tanstack/svelte-query";

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

export function useNftTokenQuery(tokenId: string) {
  return createQuery({
    ...nft.token(tokenId),
    enabled: !!tokenId, // Only run if tokenId is provided
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useNftTokenQueries(tokenIds: string[]) {
  return createQueries({
    queries: tokenIds.map((tokenId) => ({
      ...nft.token(tokenId),
    })),
  });
}
