import { FixedNumber } from ".";
import { getProjectedMemePriceInNear } from "./getProjectedMemePriceInNear";
import { calculateTokenStatsFromPoolInfo } from "./projectedMCap";

import type { Meme } from "$lib/models/memecooking";
import type { PoolInfo } from "$lib/near/ref";

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
  refPools: PoolInfo[],
  sort: {
    sort: string;
    order: string;
  },
  searchQuery: string,
  liveOnly: boolean,
  ref: boolean,
  metapool: boolean,
): T[] {
  // Filter out memes with 0 total deposit that are older than 2 days
  const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
  memes = memes.filter((meme) => {
    if (import.meta.env.VITE_NETWORK_ID === "testnet") {
      return true;
    }
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
  if (metapool) {
    // Only include Metapool campaign memes
    memes = memes.filter((meme) =>
      [
        "tattothetoo.near",
        "lightwiki139.near",
        "1459b3cf62120f42d0a53ee29e9a6d44fb8b70d187dcd201146bef9f3143d427",
        "plebes.near",
        "domai.near",
      ].includes(meme.owner),
    );
  }

  function getPoolStatFromCache(meme: Meme) {
    if (meme.pool_id === null || meme.pool_id === undefined) {
      const pricePerTokenInNear = getProjectedMemePriceInNear(meme);
      const totalSupply = BigInt(meme.total_supply || 0);
      const price = new FixedNumber(pricePerTokenInNear, 24);
      const mcap = new FixedNumber(
        pricePerTokenInNear * totalSupply,
        24 + meme.decimals,
      );
      const liquidity = new FixedNumber(BigInt(meme.total_deposit!) * 2n, 24);
      return { mcap, liquidity, price };
    }
    const poolStat = refPools[meme.pool_id];

    if (!poolStat) {
      throw new Error("Pool stat not found");
    }

    return calculateTokenStatsFromPoolInfo(meme, poolStat, meme.decimals);
  }

  switch (sort.sort) {
    case "bump order":
      return memes.sort((a, b) => {
        // Then sort by bump order
        const a_timestamp =
          Number(a.last_change_ms) || Number(a.end_timestamp_ms);
        const b_timestamp =
          Number(b.last_change_ms) || Number(b.end_timestamp_ms);
        if (sort.order === "asc") {
          return a_timestamp - b_timestamp;
        } else {
          return b_timestamp - a_timestamp;
        }
      });
    case "market cap":
      return memes.sort((a, b) => {
        const getMcap = (meme: Meme) => {
          const poolStat = getPoolStatFromCache(meme);

          return poolStat?.mcap.toNumber() ?? BigInt(meme.total_deposit ?? 0);
        };
        const aMcap = getMcap(a);
        const bMcap = getMcap(b);

        if (aMcap == null || bMcap == null) {
          return 0;
        }

        if (sort.order === "asc") {
          return aMcap > bMcap ? 1 : -1;
        } else {
          return bMcap > aMcap ? 1 : -1;
        }
      });
    case "liquidity":
      return memes.sort((a, b) => {
        const getLiquidity = (meme: Meme) => {
          const poolStat = getPoolStatFromCache(meme);
          return poolStat?.liquidity.toNumber();
        };
        const aLiquidity = getLiquidity(a);
        const bLiquidity = getLiquidity(b);

        if (aLiquidity == null || bLiquidity == null) {
          return 0;
        }

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
