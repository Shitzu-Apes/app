import { createQueryKeyStore } from "@lukemorales/query-key-factory";
import { createQueryKeys } from "@lukemorales/query-key-factory";
import { createQuery } from "@tanstack/svelte-query";

import { client, type Meme } from "../client";

import { queryClient } from ".";

import { EXTERNAL_MEMES } from "$lib/external_memes";
import type { McAccount } from "$lib/near/memecooking";

export const memesQueryFactory = createQueryKeyStore({
  memes: {
    all: () => ({
      queryKey: ["memes", "all"],
      queryFn: async (): Promise<Meme[]> => {
        const res = await client.GET("/meme");
        if (!res.data) {
          throw new Error("No memes found");
        }
        return [...res.data, ...EXTERNAL_MEMES];
      },
    }),
    detail: (memeId: string) => ({
      queryKey: ["memes", "detail", memeId],
      queryFn: async () => {
        if (Number(memeId) < 0) {
          const meme = EXTERNAL_MEMES.find(
            (meme) =>
              meme.meme_id === Number(memeId) || meme.token_id === memeId,
          );
          if (meme) return { meme };
        }

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

export function createPaginatedMemesQuery() {
  return createQuery({
    ...memesQueryFactory.memes.all(),
    staleTime: 30000, // 30 seconds
  });
}

export const memeKeys = createQueryKeys("memes", {
  deposits: (accountId: string) => ({
    queryKey: [accountId, "deposits"],
    queryFn: async (): Promise<McAccount["deposits"]> => {
      const response = await fetch(`/api/memes/${accountId}/deposits`);
      if (!response.ok) {
        throw new Error("Failed to fetch deposits");
      }
      return response.json();
    },
  }),
  claims: (accountId: string) => ({
    queryKey: [accountId, "claims"],
    queryFn: async (): Promise<McAccount["claims"]> => {
      const response = await fetch(`/api/memes/${accountId}/claims`);
      if (!response.ok) {
        throw new Error("Failed to fetch claims");
      }
      return response.json();
    },
  }),
  created: (accountId: string) => ({
    queryKey: [accountId, "created"],
    queryFn: async (): Promise<McAccount["created"]> => {
      const response = await fetch(`/api/memes/${accountId}/created`);
      if (!response.ok) {
        throw new Error("Failed to fetch created memes");
      }
      return response.json();
    },
  }),
});

export function useMemeDetailQuery(memeId: number) {
  return createQuery({
    ...memesQueryFactory.memes.detail(memeId.toString()),
    enabled: !!memeId,
    initialData: () => {
      if (Number(memeId) < 0) {
        const meme = EXTERNAL_MEMES.find((meme) => meme.meme_id === memeId);
        if (meme) return { meme };
      }
      const memes = queryClient.getQueryData(
        memesQueryFactory.memes.all().queryKey,
      ) as Meme[] | undefined;
      const meme = memes?.find((meme) => meme.meme_id === memeId);
      if (!meme) {
        // no initial data
        return undefined;
      }
      return { meme };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useDepositsQuery(accountId: string) {
  return createQuery({
    ...memeKeys.deposits(accountId),
    enabled: !!accountId,
  });
}

export function useClaimsQuery(accountId: string) {
  return createQuery({
    ...memeKeys.claims(accountId),
    enabled: !!accountId,
  });
}

export function useCreatedMemesQuery(accountId: string) {
  return createQuery({
    ...memeKeys.created(accountId),
    enabled: !!accountId,
  });
}
