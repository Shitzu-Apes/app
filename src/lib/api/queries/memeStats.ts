import { createQueryKeys } from "@lukemorales/query-key-factory";
import { createQuery } from "@tanstack/svelte-query";

import { queryClient } from ".";
import { ref } from "./ref";

import type { Meme } from "$lib/models/memecooking";
import type { PoolInfo } from "$lib/near/ref";
import type { FixedNumber } from "$lib/util";
import {
  calculateTokenStatsFromMeme,
  calculateTokenStatsFromPoolInfo,
} from "$lib/util/projectedMCap";

export type MemeStats = {
  mcap: FixedNumber;
  liquidity: FixedNumber;
};

export const memeStatsKeys = createQueryKeys("memeStats", {
  detail: (meme: Meme) => ({
    queryKey: [meme.meme_id],
    queryFn: async (): Promise<MemeStats> => {
      if (!meme.pool_id) {
        return calculateTokenStatsFromMeme(meme);
      }

      // Get pool stats from cache or fetch if needed
      const allPoolStats = queryClient.getQueryData(
        ref.all().queryKey,
      ) as PoolInfo[];
      const poolStat = allPoolStats[meme.pool_id];

      if (!poolStat) {
        throw new Error("Failed to fetch pool data");
      }

      return calculateTokenStatsFromPoolInfo(meme, poolStat, meme.decimals);
    },
  }),
});

export function useMemeStatsQuery(meme: Meme) {
  return createQuery(memeStatsKeys.detail(meme));
}
