import { createQueryKeys } from "@lukemorales/query-key-factory";
import { createQuery } from "@tanstack/svelte-query";
import { derived, type Readable } from "svelte/store";
import { z } from "zod";

import { memesQueryFactory } from "./memes";
import { useRefPoolsQuery } from "./ref";

import type { Meme } from "$lib/api/client";
import {
  calculateTokenStatsFromMeme,
  calculateTokenStatsFromPoolInfo,
} from "$lib/util/projectedMCap";

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

export type FastNearPortfolio = z.infer<typeof PortfolioSchema>;
export type EnrichedToken = FastNearPortfolio["tokens"][number] &
  Partial<Omit<Meme, "reference" | "reference_hash" | "deposit_token_id">> & {
    price: number | null;
    reference?: string | null;
    reference_hash?: string | null;
    deposit_token_id?: string | null;
  };
export type Portfolio = Omit<FastNearPortfolio, "tokens"> & {
  tokens: EnrichedToken[];
};

// Define query keys using Query Key Factory
export const portfolioKeys = createQueryKeys("portfolio", {
  fastNear: (accountId: string) => ({
    queryKey: ["fastNear", accountId],
    queryFn: async (): Promise<FastNearPortfolio> => {
      const res = await fetch(
        `https://api.fastnear.com/v1/account/${accountId}/ft`,
      );
      if (!res.ok) {
        throw new Error("Failed to fetch portfolio");
      }
      const data = await res.json();
      return PortfolioSchema.parse(data);
    },
  }),
});

// Create a reusable FastNear portfolio query
export function useFastNearPortfolioQuery(accountId: string) {
  return createQuery({
    ...portfolioKeys.fastNear(accountId),
    enabled: !!accountId,
    staleTime: 30000, // 30 seconds
  });
}

// Create a derived portfolio query that combines FastNear data with meme data
export function usePortfolioQuery(accountId: string): Readable<{
  isLoading: boolean;
  isError: boolean;
  data: Portfolio | undefined;
  error: Error | null;
  refetch: () => Promise<void>;
}> {
  const fastNearQuery = useFastNearPortfolioQuery(accountId);
  const memesQuery = createQuery(memesQueryFactory.memes.all());
  const refPoolQuery = useRefPoolsQuery();

  return derived(
    [fastNearQuery, memesQuery, refPoolQuery],
    ([$fastNear, $memes, $refPool]) => {
      const refetch = async () => {
        await Promise.all([
          $fastNear.refetch(),
          $memes.refetch(),
          $refPool.refetch(),
        ]);
      };

      if (
        $fastNear.status === "pending" ||
        $memes.status === "pending" ||
        $refPool.status === "pending" ||
        $fastNear.isFetching ||
        $memes.isFetching ||
        $refPool.isFetching
      ) {
        return {
          isLoading: true,
          isError: false,
          data: undefined,
          error: null,
          refetch,
        };
      }

      if (
        $fastNear.status === "error" ||
        $memes.status === "error" ||
        $refPool.status === "error"
      ) {
        return {
          isLoading: false,
          isError: true,
          data: undefined,
          error: $fastNear.error || $memes.error || $refPool.error,
          refetch,
        };
      }

      if (!$fastNear.data || !$memes.data) {
        console.log("portfolio is loading", $fastNear.data, $memes.data);
        return {
          isLoading: true,
          isError: false,
          data: undefined,
          error: null,
          refetch,
        };
      }

      // Process tokens with meme and pool stats data
      const tokensWithData = $fastNear.data.tokens.map((token) => {
        // Find matching meme
        const meme = $memes.data.find(
          (m: Meme) => m.token_id === token.contract_id,
        );

        if (meme) {
          try {
            if (meme.pool_id) {
              // Get pool stats from cache
              const poolStats = $refPool.data[meme.pool_id];

              if (poolStats) {
                const stats = calculateTokenStatsFromPoolInfo(
                  meme,
                  poolStats,
                  meme.decimals,
                );

                return {
                  ...token,
                  ...meme,
                  balance: token.balance,
                  price: stats.price.toNumber(),
                };
              }
            }

            const stats = calculateTokenStatsFromMeme(meme);
            return {
              ...token,
              ...meme,
              balance: token.balance,
              price: stats.price.toNumber(),
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
      });

      return {
        isLoading: false,
        isError: false,
        data: {
          ...($fastNear.data as FastNearPortfolio),
          tokens: tokensWithData,
        },
        error: null,
        refetch,
      };
    },
  );
}
