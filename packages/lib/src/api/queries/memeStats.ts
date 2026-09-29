import { derived, type Readable } from "svelte/store";

import { useMemeDetailQuery } from "./memes";
import { createNearPriceQuery } from "./prices";
import { useRefPoolsQuery } from "./ref";

import type { FixedNumber } from "$lib/util";
import {
  calculateTokenStatsFromMeme,
  calculateTokenStatsFromPoolInfo,
} from "$lib/util/projectedMCap";

export type MemeStats = {
  mcap: {
    near: FixedNumber;
    usd: FixedNumber;
  };
  liquidity: {
    near: FixedNumber;
    usd: FixedNumber;
  };
};

// Create a derived meme stats query that combines meme data with pool stats
export function useMemeStatsQuery(memeId: number): Readable<{
  isLoading: boolean;
  isError: boolean;
  data: MemeStats | undefined;
  error: Error | null;
  refetch: () => Promise<void>;
}> {
  const memeQuery = useMemeDetailQuery(memeId);
  const refPoolQuery = useRefPoolsQuery();
  const nearPriceQuery = createNearPriceQuery();

  return derived(
    [memeQuery, refPoolQuery, nearPriceQuery],
    ([$meme, $refPool, $nearPrice]) => {
      const refetch = async () => {
        await Promise.all([
          $meme.refetch(),
          $refPool.refetch(),
          $nearPrice.refetch(),
        ]);
      };

      if ($meme.isFetching || $refPool.isFetching || $nearPrice.isFetching) {
        return {
          isLoading: true,
          isError: false,
          data: undefined,
          error: null,
          refetch,
        };
      }

      if (
        $meme.status === "error" ||
        $refPool.status === "error" ||
        $nearPrice.status === "error"
      ) {
        return {
          isLoading: false,
          isError: true,
          data: undefined,
          error: $meme.error || $refPool.error || $nearPrice.error,
          refetch,
        };
      }

      if (!$meme.data) {
        return {
          isLoading: true,
          isError: false,
          data: undefined,
          error: null,
          refetch,
        };
      }

      const meme = $meme.data.meme;
      if (!meme) {
        return {
          isLoading: false,
          isError: true,
          data: undefined,
          error: new Error(`Meme with id ${memeId} not found`),
          refetch,
        };
      }

      if (!$nearPrice.data) {
        return {
          isLoading: false,
          isError: true,
          data: undefined,
          error: new Error("Near price not found"),
          refetch,
        };
      }
      try {
        if (meme.pool_id && $refPool.data) {
          const poolStats = $refPool.data[meme.pool_id];
          if (poolStats) {
            const stat = calculateTokenStatsFromPoolInfo(
              meme,
              poolStats,
              meme.decimals,
            );

            return {
              isLoading: false,
              isError: false,
              data: {
                mcap: {
                  near: stat.mcap,
                  usd: stat.mcap.mul($nearPrice.data),
                },
                liquidity: {
                  near: stat.liquidity,
                  usd: stat.liquidity.mul($nearPrice.data),
                },
              },
              error: null,
              refetch,
            };
          }
        }

        const stat = calculateTokenStatsFromMeme(meme);

        return {
          isLoading: false,
          isError: false,
          data: {
            mcap: {
              near: stat.mcap,
              usd: stat.mcap.mul($nearPrice.data),
            },
            liquidity: {
              near: stat.liquidity,
              usd: stat.liquidity.mul($nearPrice.data),
            },
          },
          error: null,
          refetch,
        };
      } catch (err) {
        return {
          isLoading: false,
          isError: true,
          data: undefined,
          error:
            err instanceof Error
              ? err
              : new Error("Failed to calculate meme stats"),
          refetch,
        };
      }
    },
  );
}
