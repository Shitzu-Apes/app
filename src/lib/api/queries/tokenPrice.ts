import { createQueryKeys } from "@lukemorales/query-key-factory";
import { createQuery } from "@tanstack/svelte-query";

import { queryClient } from ".";
import { tokensKeys, type TokenId } from "./tokens";

// Query keys for token prices
export const tokenPriceKeys = createQueryKeys("tokenPrice", {
  currentPrice: (tokenId: string) => ({
    queryKey: [tokenId],
    queryFn: async () => {
      // First, try to get token price from existing tokens query data
      const allTokensData = queryClient.getQueryData<{
        [key in TokenId]?: { price?: string };
      }>(tokensKeys.all().queryKey);

      if (allTokensData && allTokensData[tokenId as TokenId]?.price) {
        // If the data exists in the tokens query, return that price
        return allTokensData[tokenId as TokenId]!.price!;
      }

      // If the data doesn't exist in the query cache, use the tokens query to fetch it
      try {
        const result = await queryClient.fetchQuery(tokensKeys.all());
        if (result && result[tokenId as TokenId]?.price) {
          return result[tokenId as TokenId].price!;
        }
      } catch (error) {
        console.error("Error fetching token price:", error);
      }

      // If we still don't have a price, return 0
      return "0";
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
