import { derived, type Readable } from "svelte/store";

import { useMemeDetailQuery } from "./memes";
import { createNearPriceQuery } from "./prices";

import { ensurePoolsLoaded, poolsById$ } from "$lib/store/poolInfo";
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
export function useMemeStatsQuery(
  memeId: number,
  poolId?: number | null,
): Readable<{
  isLoading: boolean;
  isError: boolean;
  data: MemeStats | undefined;
  error: Error | null;
  refetch: () => Promise<void>;
}> {
  const memeQuery = useMemeDetailQuery(memeId);
  const nearPriceQuery = createNearPriceQuery();

  ensurePoolsLoaded([poolId]);

  return derived(
    [memeQuery, poolsById$, nearPriceQuery],
    ([$meme, $pools, $nearPrice]) => {
      const refetch = async () => {
        ensurePoolsLoaded([poolId]);
        await Promise.all([$meme.refetch(), $nearPrice.refetch()]);
      };

      if ($meme.isFetching || $nearPrice.isFetching) {
        return {
          isLoading: true,
          isError: false,
          data: undefined,
          error: null,
          refetch,
        };
      }

      if ($meme.status === "error" || $nearPrice.status === "error") {
        return {
          isLoading: false,
          isError: true,
          data: undefined,
          error: $meme.error || $nearPrice.error,
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
        const poolStat = $pools.get(poolId ?? meme.pool_id ?? -1);
        if (poolStat) {
          const stat = calculateTokenStatsFromPoolInfo(
            meme,
            poolStat,
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
