import { createQueryKeyStore } from "@lukemorales/query-key-factory";
import { createQuery } from "@tanstack/svelte-query";
import { get } from "svelte/store";

import { memeMap$ } from "$lib/store/memebids";
import { calculateTokenStats } from "$lib/util/projectedMCap";

export const queryFactory = createQueryKeyStore({
  poolStat: {
    all: null,
    detail: (memeId: string) => ({
      queryKey: ["poolStat", memeId],
      queryFn: () => {
        const meme = get(memeMap$).get(Number(memeId));
        if (!meme) {
          throw new Error("Meme not found");
        }
        return calculateTokenStats(meme);
      },
    }),
  },
});

export function createPoolStatQuery(memeId: string) {
  return createQuery(queryFactory.poolStat.detail(memeId));
}
