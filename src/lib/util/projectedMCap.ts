import { derived, writable, type Readable, type Writable } from "svelte/store";

import { FixedNumber } from "./FixedNumber";

import type { Meme } from "$lib/api/client";
import { Ref } from "$lib/near";

export function projectedMCap(meme: Meme): Readable<FixedNumber> {
  if (meme.pool_id) {
    const tokenPrice = writable<bigint>(0n);
    getTokenPrice(meme.pool_id, meme.decimals).then((price) =>
      tokenPrice.set(price),
    );

    return derived([nearPrice, tokenPrice], ([$nearPrice, $tokenPrice]) => {
      getNearPrice();
      return new FixedNumber(
        $tokenPrice * BigInt(meme.total_supply!),
        meme.decimals + 24,
      ).mul(new FixedNumber($nearPrice, 24));
    });
  } else {
    return derived(nearPrice, (price) => {
      getNearPrice();

      // Calculate liquidity pool allocation (delta = 1/1.98 of non-team allocation)
      const delta = 1 / 1.98;
      const teamAllocationBps =
        (meme.team_allocation_num || 0) / (meme.total_supply_num || 1);
      const teamAllocationPercent = teamAllocationBps;
      const nonTeamAllocationPercent = 1 - teamAllocationPercent;
      const liquidityPoolPercent = nonTeamAllocationPercent * delta;

      // Calculate number of tokens in liquidity pool
      const totalSupply = BigInt(meme.total_supply || 0);
      const tokensInLiquidityPool =
        (totalSupply * BigInt(Math.floor(liquidityPoolPercent * 10000))) /
        10000n;

      // Calculate NEAR in liquidity pool (total deposits)
      const nearInLiquidityPool =
        (BigInt(meme.total_deposit) * BigInt(98)) / BigInt(100);

      // Calculate price per token in NEAR
      const pricePerTokenInNear =
        nearInLiquidityPool === 0n
          ? 0n
          : (nearInLiquidityPool * 10n ** 24n) / tokensInLiquidityPool;

      // Convert to USD using NEAR price and multiply by total supply
      return new FixedNumber(pricePerTokenInNear * totalSupply, 48).mul(
        new FixedNumber(price, 24),
      );
    });
  }
}

async function getTokenPrice(
  poolId: number,
  decimals: number,
): Promise<bigint> {
  const pool = await Ref.getPool(poolId);

  const denomIdx = pool.token_account_ids.indexOf(
    import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID,
  );
  const tokenIdx = denomIdx === 0 ? 1 : 0;

  const denomAmount = pool.amounts[denomIdx];
  const tokenAmount = pool.amounts[tokenIdx];

  return new FixedNumber(BigInt(denomAmount), 24)
    .div(new FixedNumber(BigInt(tokenAmount), decimals))
    .toBigInt();
}

export const nearPrice = writable<bigint>(0n);

let cachePrice = { price: 0n, expiry: 0 };
let fetchPromise: Promise<Writable<bigint>> | null = null;

export async function getNearPrice(): Promise<Writable<bigint>> {
  if (cachePrice.expiry > Date.now()) {
    nearPrice.set(cachePrice.price);
    return nearPrice;
  }

  try {
    if (!fetchPromise) {
      fetchPromise = fetch(
        `https://api.dexscreener.com/latest/dex/pairs/near/refv1-4512`,
      ).then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        cachePrice = {
          price: BigInt(1e24 / parseFloat(data.pair.priceNative)),
          expiry: Date.now() + 1000 * 60 * 5,
        };
        nearPrice.set(cachePrice.price);
        fetchPromise = null;
        return nearPrice;
      });
    }

    return await fetchPromise;
  } catch (error) {
    if (cachePrice.price !== 0n) {
      nearPrice.set(cachePrice.price);
      return nearPrice;
    }
    throw error;
  }
}
