import { createQueryKeyStore } from "@lukemorales/query-key-factory";
import { createQuery } from "@tanstack/svelte-query";
import { derived, type Readable } from "svelte/store";

import { client, type Meme } from "../client";

import { queryClient } from ".";

import { EXTERNAL_MEMES } from "$lib/external_memes";

export const memesQueryFactory = createQueryKeyStore({
  memes: {
    all: {
      queryKey: ["memes", "all"],
      queryFn: async () => {
        const res = await client.GET("/meme");
        if (!res.data) return [];
        const memes: Meme[] = [...res.data, ...EXTERNAL_MEMES];
        return memes;
      },
    },
    detail: (memeId: string) => ({
      queryKey: ["memes", "detail", memeId],
      queryFn: async () => {
        const res = await client.GET(`/meme/{id}`, {
          params: {
            path: {
              id: memeId,
            },
          },
        });
        if (!res.data) return null;
        return res.data;
      },
    }),
  },
});

export function createMemesQuery() {
  return createQuery({
    ...memesQueryFactory.memes.all,
    staleTime: Infinity,
  });
}

export function createMemeDetailQuery(memeId: Readable<number>) {
  return createQuery(
    derived(memeId, (memeId) => {
      const memes = queryClient.getQueryData(
        memesQueryFactory.memes.all.queryKey,
      ) as Meme[] | undefined;
      const meme = memes?.find(
        (meme) => Number(meme.meme_id) === Number(memeId),
      );
      return {
        ...memesQueryFactory.memes.detail(memeId.toString()),
        staleTime: Infinity,
        initialData: meme ? { meme } : undefined,
      };
    }),
  );
}
