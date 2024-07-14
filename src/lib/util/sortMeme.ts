import type { MCMemeInfo } from "$lib/models/memecooking";

export const sortOptions = [
  { label: "sort: bump order", value: "bump order" },
  { label: "sort: market cap", value: "market cap" },
  { label: "sort: creation time", value: "creation time" },
  { label: "sort: live", value: "live" },
];

export const orderOptions = [
  { label: "order: desc", value: "desc" },
  { label: "order: asc", value: "asc" },
];

export function sortMeme<T extends MCMemeInfo>(
  memes: T[],
  sort: {
    sort: string;
    order: string;
  },
): T[] {
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
    case "live":
      return memes.sort((a, b) => {
        if (sort.order === "asc") {
          return a.end_timestamp_ms - b.end_timestamp_ms;
        } else {
          return b.end_timestamp_ms - a.end_timestamp_ms;
        }
      });
  }

  return [];
}
