import { get } from "svelte/store";

import type { Meme } from "$lib/models/memecooking";

export const sortOptions = [
  { label: "bump order", value: "bump order" },
  { label: "market cap", value: "market cap" },
  { label: "creation time", value: "creation time" },
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
    // Only include memes that have a pool ID and a valid meme ID
    memes = memes.filter((meme) => {
      const hasPoolId = meme.pool_id !== null;
      const isMemeCooking = meme.meme_id >= 0;
      return hasPoolId && isMemeCooking;
    });
  }

  switch (sort.sort) {
    case "bump order":
      return memes.sort((a, b) => {
        // Then sort by bump order
        if (sort.order === "asc") {
          return Number(a.last_change_ms) - Number(b.last_change_ms);
        } else {
          return Number(b.last_change_ms) - Number(a.last_change_ms);
        }
      });
    case "market cap":
      return memes.sort((a, b) => {
        if (sort.order === "asc") {
          if (a.projectedPoolStats != null && b.projectedPoolStats) {
            return get(a.projectedPoolStats).mcap.toBigInt() >
              get(b.projectedPoolStats).mcap.toBigInt()
              ? 1
              : -1;
          } else {
            return BigInt(a.total_deposit) > BigInt(b.total_deposit) ? 1 : -1;
          }
        } else {
          if (a.projectedPoolStats != null && b.projectedPoolStats) {
            return get(b.projectedPoolStats).mcap.toBigInt() >
              get(a.projectedPoolStats).mcap.toBigInt()
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
