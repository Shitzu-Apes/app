import type { MCMemeInfo } from "$lib/models/memecooking";

export const sortOptions = [
  { label: "sort: bump order", value: "bump order" },
  { label: "sort: market cap", value: "market cap" },
  { label: "sort: creation time", value: "creation time" },
];

export const orderOptions = [
  { label: "order: desc", value: "desc" },
  { label: "order: asc", value: "asc" },
];

export function filterAndSortMeme<T extends MCMemeInfo>(
  memes: T[],
  sort: {
    sort: string;
    order: string;
  },
  liveOnly: boolean,
): T[] {
  if (liveOnly) {
    memes = memes.filter((meme) => meme.end_timestamp_ms > Date.now());
  }

  switch (sort.sort) {
    case "bump order":
      return memes;
    // return memes.sort((a, b) => {
    //   if (sort.order === "asc") {
    //     return a - b;
    //   } else {
    //     return b - a;
    //   }
    // });
    case "market cap":
      return memes.sort((a, b) => {
        if (sort.order === "asc") {
          return BigInt(a.total_staked) > BigInt(b.total_staked) ? 1 : -1;
        } else {
          return BigInt(b.total_staked) > BigInt(a.total_staked) ? 1 : -1;
        }
      });
    case "creation time":
      return memes.sort((a, b) => {
        if (sort.order === "asc") {
          return a.id - b.id;
        } else {
          return b.id - a.id;
        }
      });
  }

  return [];
}
