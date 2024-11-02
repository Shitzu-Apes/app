import { get } from "svelte/store";

import type { Meme } from "$lib/models/memecooking";

export const sortOptions = [
  { label: "sort: bump order", value: "bump order" },
  { label: "sort: market cap", value: "market cap" },
  { label: "sort: creation time", value: "creation time" },
];

export const orderOptions = [
  { label: "order: desc", value: "desc" },
  { label: "order: asc", value: "asc" },
];

export function filterAndSortMeme<T extends Meme>(
  memes: T[],
  sort: {
    sort: string;
    order: string;
  },
  searchQuery: string,
  liveOnly: boolean,
  ref: boolean,
): T[] {
  console.log("[filterAndSortMeme] memes", memes);
  if (liveOnly) {
    memes = memes.filter(
      (meme) => meme.end_timestamp_ms && meme.end_timestamp_ms > Date.now(),
    );
  }
  if (searchQuery) {
    memes = memes.filter((meme) => {
      return (
        meme.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        meme.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        meme.owner.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }
  if (ref) {
    memes = memes.filter((meme) => meme.pool_id !== null);
  }

  switch (sort.sort) {
    case "bump order":
      return memes.sort((a, b) => {
        // First compare live/launched vs failed status
        const aIsActive = a.end_timestamp_ms && a.end_timestamp_ms > Date.now();
        const bIsActive = b.end_timestamp_ms && b.end_timestamp_ms > Date.now();
        const aIsLaunched = a.pool_id !== null;
        const bIsLaunched = b.pool_id !== null;

        if ((aIsActive || aIsLaunched) && !(bIsActive || bIsLaunched))
          return -1;
        if (!(aIsActive || aIsLaunched) && (bIsActive || bIsLaunched)) return 1;

        // Then sort by bump order
        if (sort.order === "asc") {
          return a.last_change_ms - b.last_change_ms;
        } else {
          return b.last_change_ms - a.last_change_ms;
        }
      });
    case "market cap":
      return memes.sort((a, b) => {
        if (sort.order === "asc") {
          if (a.projectedMcap != null && b.projectedMcap) {
            return get(a.projectedMcap).toBigInt() >
              get(b.projectedMcap).toBigInt()
              ? 1
              : -1;
          } else {
            return BigInt(a.total_deposit) > BigInt(b.total_deposit) ? 1 : -1;
          }
        } else {
          if (a.projectedMcap != null && b.projectedMcap) {
            return get(b.projectedMcap).toBigInt() >
              get(a.projectedMcap).toBigInt()
              ? 1
              : -1;
          } else {
            return BigInt(b.total_deposit) > BigInt(a.total_deposit) ? 1 : -1;
          }
        }
      });
    case "creation time":
      return memes.sort((a, b) => {
        if (sort.order === "asc") {
          return a.meme_id - b.meme_id;
        } else {
          return b.meme_id - a.meme_id;
        }
      });
  }

  return [];
}
