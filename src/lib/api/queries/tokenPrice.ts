import { createQueryKeys } from "@lukemorales/query-key-factory";
import { createQuery } from "@tanstack/svelte-query";

import { queryClient } from ".";
import { tokensKeys } from "./tokens";

import { poolIds, type TokenId } from "$lib/models/tokens";

async function fetchDexscreenerPrice(tokenId: TokenId): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/pairs/near/refv1-${poolIds[tokenId].poolId}`,
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      pairs?: { priceUsd?: string }[];
    };

    return data.pairs?.[0]?.priceUsd ?? null;
  } catch (error) {
    console.error("Error fetching Dexscreener token price:", error);
    return null;
  }
}

export const tokenPriceKeys = createQueryKeys("tokenPrice", {
  currentPrice: (tokenId: string) => ({
    queryKey: [tokenId],
    queryFn: async (): Promise<string | null> => {
      const allTokensData = queryClient.getQueryData<{
        [key in TokenId]?: { price?: string };
      }>(tokensKeys.all().queryKey);

      if (allTokensData && allTokensData[tokenId as TokenId]?.price) {
        return allTokensData[tokenId as TokenId]!.price!;
      }

      try {
        const result = await queryClient.fetchQuery(tokensKeys.all());
        if (result && result[tokenId as TokenId]?.price) {
          return result[tokenId as TokenId].price!;
        }
      } catch (error) {
        console.error("Error fetching token price:", error);
      }

      if (tokenId in poolIds) {
        return fetchDexscreenerPrice(tokenId as TokenId);
      }

      return null;
    },
  }),
});

/**
 * Hook to get the current price of Shitzu token
 */
export function useCurrentShitzuPriceQuery() {
  return createQuery({
    ...tokenPriceKeys.currentPrice("token.0xshitzu.near"),
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 30 * 1000, // 30 seconds
  });
}
