import { createQueryKeys } from "@lukemorales/query-key-factory";
import { createQuery } from "@tanstack/svelte-query";
import { z } from "zod";

import { queryClient } from ".";
import { memesQueryFactory } from "./memes";
import { poolStatQueryFactory } from "./poolStat";

import type { Meme } from "$lib/api/client";
import { FixedNumber } from "$lib/util";

interface TokenStats {
  price: FixedNumber | null;
  marketCap: FixedNumber | null;
  volume24h: FixedNumber | null;
}

// Zod schema for portfolio data validation
const TokenSchema = z.object({
  balance: z.string(), // Represents a bigint as string
  contract_id: z.string(),
  last_update_block_height: z.number().nullable(),
  price: z.number().nullable().optional(),
  meme_id: z.number().optional(),
  owner: z.string().optional(),
  end_timestamp_ms: z.number().nullable().optional(),
  name: z.string().optional(),
  symbol: z.string().optional(),
  decimals: z.number().optional(),
  total_supply: z.string().nullish().optional(), // Represents a bigint as string
  reference: z.string().nullable().optional(),
  reference_hash: z.string().nullable().optional(),
  deposit_token_id: z.string().nullable().optional(),
  pool_id: z.number().nullable().optional(),
  description: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
});

const PortfolioSchema = z.object({
  account_id: z.string(),
  tokens: z.array(TokenSchema),
});

export type Portfolio = z.infer<typeof PortfolioSchema>;

// Define query keys using Query Key Factory
export const portfolioKeys = createQueryKeys("portfolio", {
  detail: (accountId: string) => ({
    queryKey: [accountId],
    queryFn: async (): Promise<Portfolio> => {
      // Fetch base portfolio data
      const res = await fetch(
        `https://api.fastnear.com/v1/account/${accountId}/ft`,
      );
      if (!res.ok) {
        throw new Error("Failed to fetch portfolio");
      }
      const data = await res.json();
      const validated = PortfolioSchema.parse(data);

      // Get meme data from the query cache
      let memes = queryClient.getQueryData(
        memesQueryFactory.memes.all().queryKey,
      ) as Meme[] | undefined;

      if (!memes) {
        await queryClient.fetchQuery(memesQueryFactory.memes.all());
        memes = queryClient.getQueryData(
          memesQueryFactory.memes.all().queryKey,
        ) as Meme[] | undefined;
      }

      // Process tokens with meme and pool stats data
      const tokensWithData = await Promise.all(
        validated.tokens.map(async (token) => {
          // Find matching meme
          const meme = memes?.find(
            (m: Meme) => m.token_id === token.contract_id,
          );

          if (meme) {
            try {
              // Get pool stats from cache or fetch if needed
              const poolStats = queryClient.getQueryData(
                poolStatQueryFactory.poolStat.detail(meme).queryKey,
              ) as TokenStats | undefined;

              if (!poolStats) {
                // If not in cache, fetch pool stats
                await queryClient.fetchQuery(
                  poolStatQueryFactory.poolStat.detail(meme),
                );
              }

              const currentPoolStats = queryClient.getQueryData(
                poolStatQueryFactory.poolStat.detail(meme).queryKey,
              ) as TokenStats | undefined;

              return {
                ...token,
                ...meme,
                balance: token.balance,
                price: currentPoolStats?.price?.toNumber() ?? null,
              };
            } catch (err) {
              return {
                ...token,
                price: null,
              };
            }
          }

          return {
            ...token,
            price: null,
          };
        }),
      );

      return {
        ...validated,
        tokens: tokensWithData,
      };
    },
  }),
});

// Create a reusable portfolio query
export function usePortfolioQuery(accountId: string) {
  return createQuery({
    ...portfolioKeys.detail(accountId),
    enabled: !!accountId,
    staleTime: 30000, // 30 seconds
  });
}
