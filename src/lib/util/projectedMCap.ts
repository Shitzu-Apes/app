import { derived, writable, type Readable } from "svelte/store";

import { FixedNumber } from "./FixedNumber";
import { getProjectedMemePriceInNear } from "./getProjectedMemePriceInNear";

import type { Meme } from "$lib/api/client";
import { Ref, type PoolInfo } from "$lib/near";

// Centralized store for token prices
const tokenPrices = writable<
  Map<number, { mcap: FixedNumber; liquidity: FixedNumber; price: FixedNumber }>
>(new Map());

export function getTokenPrice(meme: Meme): Readable<FixedNumber | null> {
  return derived([tokenPrices], ([$tokenPrices]) => {
    return $tokenPrices.get(meme.meme_id)?.price ?? null;
  });
}

export function projectedPoolStats(
  meme: Meme,
): Readable<{ mcap: FixedNumber; liquidity: FixedNumber }> {
  return derived([tokenPrices, nearPrice], ([$tokenPrices, $nearPrice]) => {
    if (!$tokenPrices.has(meme.meme_id)) {
      updateTokenPrice(meme);
    }
    return (
      $tokenPrices.get(meme.meme_id) || {
        mcap: new FixedNumber(0n, 0).mul(new FixedNumber($nearPrice, 24)),
        liquidity: new FixedNumber(0n, 0).mul(new FixedNumber($nearPrice, 24)),
      }
    );
  });
}

export async function calculateTokenStats(meme: Meme) {
  if (meme.pool_id) {
    const stats = await getPoolStats(meme.pool_id, meme.decimals);
    const totalSupplyBigInt = BigInt(meme.total_supply!);
    const price = new FixedNumber(stats.price, 24);
    const mcap = new FixedNumber(
      stats.price * totalSupplyBigInt,
      meme.decimals + 24,
    );
    const liquidity = new FixedNumber(stats.liquidity, 24);

    return { mcap, liquidity, price };
  } else {
    return calculateTokenStatsFromMeme(meme);
  }
}

export function calculateTokenStatsFromMeme(meme: Meme) {
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

export function calculateTokenStatsFromPoolInfo(
  meme: Meme,
  poolInfo: PoolInfo,
  decimals: number,
) {
  let mcap: FixedNumber;
  let liquidity: FixedNumber;
  let price: FixedNumber;

  if (meme.pool_id) {
    const stats = getPoolStatsFromPoolInfo(poolInfo, decimals);
    const totalSupplyBigInt = BigInt(meme.total_supply!);
    price = new FixedNumber(stats.price, 24);
    mcap = new FixedNumber(stats.price * totalSupplyBigInt, meme.decimals + 24);
    liquidity = new FixedNumber(stats.liquidity, 24);
  } else {
    const pricePerTokenInNear = getProjectedMemePriceInNear(meme);
    const totalSupply = BigInt(meme.total_supply || 0);
    price = new FixedNumber(pricePerTokenInNear, 24);
    mcap = new FixedNumber(
      pricePerTokenInNear * totalSupply,
      24 + meme.decimals,
    );
    liquidity = new FixedNumber(BigInt(meme.total_deposit!) * 2n, 24);
  }

  return { mcap, liquidity, price };
}

export async function updateTokenPrice(_meme: Meme) {
  // const stats = await calculateTokenStats(meme);
  // tokenPrices.update((prices) => {
  //   prices.set(meme.meme_id, stats);
  //   return prices;
  // });
}

export function projectedMCap(meme: Meme): Readable<FixedNumber> {
  return derived(projectedPoolStats(meme), (stats) => stats.mcap);
}

async function getPoolStats(
  poolId: number,
  decimals: number,
): Promise<{ price: bigint; liquidity: bigint }> {
  const pool = await Ref.getPool(poolId);

  return getPoolStatsFromPoolInfo(pool, decimals);
}

function getPoolStatsFromPoolInfo(poolInfo: PoolInfo, decimals: number) {
  const denomIdx = poolInfo.token_account_ids.indexOf(
    import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID,
  );
  const tokenIdx = denomIdx === 0 ? 1 : 0;

  const denomAmount = poolInfo.amounts[denomIdx];
  const tokenAmount = poolInfo.amounts[tokenIdx];

  const price = new FixedNumber(BigInt(denomAmount), 24)
    .div(new FixedNumber(BigInt(tokenAmount), decimals))
    .toBigInt();

  const liquidity = BigInt(denomAmount) * 2n;

  return { price, liquidity };
}

export const nearPrice = writable<bigint>(0n);

let cachePrice = { price: 0n, expiry: 0 };

export async function getNearPrice(): Promise<bigint> {
  if (import.meta.env.VITE_NETWORK_ID === "testnet") {
    const price = 5n * BigInt(1e24);
    nearPrice.set(price);
    return price;
  }
  if (cachePrice.expiry > Date.now()) {
    return cachePrice.price;
  }

  try {
    // 4512 is the poolId for wrap.near/usd
    const { price: usdPerNear } = await getPoolStats(4512, 6);
    const price = (BigInt(1e24) * BigInt(1e24)) / BigInt(usdPerNear);

    cachePrice = {
      price,
      expiry: Date.now() + 1000 * 60 * 5,
    };
    nearPrice.set(price);
    return price;
  } catch (error) {
    if (cachePrice.price !== 0n) {
      return cachePrice.price;
    }
    throw error;
  }
}
