import { get } from "svelte/store";

import type { Meme } from "$lib/models/memecooking";

export const sortOptions = [
  { label: "bump order", value: "bump order" },
  { label: "market cap", value: "market cap" },
  { label: "creation time", value: "creation time" },
  { label: "liquidity", value: "liquidity" },
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
  // Filter out memes with 0 total deposit that are older than 2 days
  const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
  memes = memes.filter((meme) => {
    // except for external memes
    if (meme.meme_id < 0) {
      return true;
    }
    // Keep meme if it has deposits or has pool ID
    if (BigInt(meme.total_deposit!) > 0n || meme.pool_id !== null) {
      return true;
    }
    // Or if it's newer than 2 days

    return meme.created_timestamp_ms! > twoDaysAgo;
  });

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
        const getMcap = (meme: Meme) =>
          meme.projectedPoolStats != null
            ? get(meme.projectedPoolStats).mcap.toNumber()
            : BigInt(meme.total_deposit ?? 0);
        const aMcap = getMcap(a);
        const bMcap = getMcap(b);

        if (sort.order === "asc") {
          return aMcap > bMcap ? 1 : -1;
        } else {
          return bMcap > aMcap ? 1 : -1;
        }
      });
    case "liquidity":
      return memes.sort((a, b) => {
        const getLiquidity = (meme: Meme) =>
          meme.projectedPoolStats != null
            ? get(meme.projectedPoolStats).liquidity.toNumber()
            : BigInt(meme.total_deposit ?? 0);
        const aLiquidity = getLiquidity(a);
        const bLiquidity = getLiquidity(b);

        if (sort.order === "asc") {
          return aLiquidity > bLiquidity ? 1 : -1;
        } else {
          return bLiquidity > aLiquidity ? 1 : -1;
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
