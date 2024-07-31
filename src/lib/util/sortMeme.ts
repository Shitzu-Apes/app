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
  liveOnly: boolean,
): T[] {
  console.log("[filterAndSortMeme] memes", memes);
  if (liveOnly) {
    memes = memes.filter(
      (meme) => meme.end_timestamp_ms && meme.end_timestamp_ms > Date.now(),
    );
  }

  switch (sort.sort) {
    case "bump order":
      return memes.sort((a, b) => {
        if (sort.order === "asc") {
          return a.last_change_ms - b.last_change_ms;
        } else {
          return b.last_change_ms - a.last_change_ms;
        }
      });
    case "market cap":
      return memes.sort((a, b) => {
        if (sort.order === "asc") {
          return BigInt(a.total_deposit) > BigInt(b.total_deposit) ? 1 : -1;
        } else {
          return BigInt(b.total_deposit) > BigInt(a.total_deposit) ? 1 : -1;
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
