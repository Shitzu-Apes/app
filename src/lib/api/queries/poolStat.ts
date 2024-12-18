import { createQueryKeyStore } from "@lukemorales/query-key-factory";
import {
  createQueries,
  createQuery,
  type CreateQueryResult,
} from "@tanstack/svelte-query";
import { derived } from "svelte/store";

import type { Meme } from "$lib/models/memecooking";
import { calculateTokenStats } from "$lib/util/projectedMCap";

export const poolStatQueryFactory = createQueryKeyStore({
  poolStat: {
    all: null,
    detail: (meme: Meme) => ({
      queryKey: ["poolStat", meme.meme_id.toString()],
      queryFn: () => {
        return calculateTokenStats(meme);
      },
    }),
  },
});

export function createPoolStatQuery(meme: Meme) {
  return createQuery({
    ...poolStatQueryFactory.poolStat.detail(meme),
    staleTime: Infinity,
  });
}

export function createPoolStatsQueries(memesQuery: CreateQueryResult<Meme[]>) {
  return createQueries({
    queries: derived(memesQuery, (memes) => {
      return (
        memes.data?.map((meme) => ({
          ...poolStatQueryFactory.poolStat.detail(meme),
          enabled: meme !== undefined,
          staleTime: Infinity,
        })) ?? []
      );
    }),
  });
}
