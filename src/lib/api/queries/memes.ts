import { createQueryKeyStore } from "@lukemorales/query-key-factory";
import { createQuery } from "@tanstack/svelte-query";
import { derived, type Readable } from "svelte/store";

import { client, type Meme } from "../client";

import { queryClient } from ".";

import { EXTERNAL_MEMES } from "$lib/external_memes";

export type MemeQueryParams = {
  page?: number;
  limit?: number;
  tab?: "all" | "launched" | "other" | "metapool";
  isLive?: boolean;
};

export type PaginatedMemeResponse = {
  memes: Meme[];
  total: number;
};

export const memesQueryFactory = createQueryKeyStore({
  memes: {
    paginated: (params: MemeQueryParams) => ({
      queryKey: ["memes", "paginated", params],
      queryFn: async (): Promise<PaginatedMemeResponse> => {
        if (params.tab === "other") {
          // Handle external memes with client-side pagination
          const start = ((params.page || 1) - 1) * (params.limit || 10);
          const end = start + (params.limit || 10);
          return {
            memes: EXTERNAL_MEMES.slice(start, end),
            total: EXTERNAL_MEMES.length,
          };
        }

        const res = await client.GET("/meme/paginated", {
          params: {
            query: {
              page: params.page || 1,
              limit: params.limit || 10,
              tab: params.tab || "all",
              is_live: params.isLive,
            },
          },
        });

        if (!res.data) return { memes: [], total: 0 };
        return res.data;
      },
    }),
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

export function createPaginatedMemesQuery(params: MemeQueryParams) {
  return createQuery({
    ...memesQueryFactory.memes.paginated(params),
    staleTime: 30000, // 30 seconds
  });
}

export function createMemeDetailQuery(memeId: Readable<number>) {
  return createQuery(
    derived(memeId, (memeId) => {
      const memes = queryClient.getQueryData(
        memesQueryFactory.memes.paginated({ tab: "all" }).queryKey,
      ) as PaginatedMemeResponse | undefined;
      const meme = memes?.memes.find(
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
