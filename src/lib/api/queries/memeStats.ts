import { derived, type Readable } from "svelte/store";

import { useMemeDetailQuery } from "./memes";
import { createRefPoolsQuery } from "./ref";

import type { FixedNumber } from "$lib/util";
import {
  calculateTokenStatsFromMeme,
  calculateTokenStatsFromPoolInfo,
} from "$lib/util/projectedMCap";

export type MemeStats = {
  mcap: FixedNumber;
  liquidity: FixedNumber;
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
  const refPoolQuery = createRefPoolsQuery();

  return derived([memeQuery, refPoolQuery], ([$meme, $refPool]) => {
    const refetch = async () => {
      await Promise.all([$meme.refetch(), $refPool.refetch()]);
    };

    if ($meme.isFetching || $refPool.isFetching) {
      return {
        isLoading: true,
        isError: false,
        data: undefined,
        error: null,
        refetch,
      };
    }

    if ($meme.status === "error" || $refPool.status === "error") {
      return {
        isLoading: false,
        isError: true,
        data: undefined,
        error: $meme.error || $refPool.error,
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

    try {
      if (meme.pool_id && $refPool.data) {
        const poolStats = $refPool.data[meme.pool_id];
        if (poolStats) {
          return {
            isLoading: false,
            isError: false,
            data: calculateTokenStatsFromPoolInfo(
              meme,
              poolStats,
              meme.decimals,
            ),
            error: null,
            refetch,
          };
        }
      }

      return {
        isLoading: false,
        isError: false,
        data: calculateTokenStatsFromMeme(meme),
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
  });
}
