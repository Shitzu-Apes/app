import { derived, writable, type Readable, type Writable } from "svelte/store";

import { FixedNumber } from "./FixedNumber";
import { getProjectedMemePriceInNear } from "./getProjectedMemePriceInNear";

import type { Meme } from "$lib/api/client";
import { Ref } from "$lib/near";

export function projectedPoolStats(
  meme: Meme,
): Readable<{ mcap: FixedNumber; liquidity: FixedNumber }> {
  if (meme.pool_id) {
    return projectedPoolStatsFromRef(meme);
  } else {
    return projectedPoolStatsFromAuction(meme);
  }
}

function projectedPoolStatsFromAuction(
  meme: Meme,
): Readable<{ mcap: FixedNumber; liquidity: FixedNumber }> {
  return derived(nearPrice, (price) => {
    getNearPrice();

    const pricePerTokenInNear = getProjectedMemePriceInNear(meme);
    const totalSupply = BigInt(meme.total_supply || 0);

    // Convert to USD using NEAR price and multiply by total supply
    const mcap = new FixedNumber(
      pricePerTokenInNear * totalSupply,
      24 + meme.decimals,
    ).mul(new FixedNumber(price, 24));

    const liquidity = new FixedNumber(BigInt(meme.total_deposit) * 2n, 24).mul(
      new FixedNumber(price, 24),
    );

    return { mcap, liquidity };
  });
}

function projectedPoolStatsFromRef(
  meme: Pick<Meme, "pool_id" | "total_supply" | "decimals">,
): Readable<{ mcap: FixedNumber; liquidity: FixedNumber }> {
  if (!meme.pool_id) throw new Error();
  const tokenPrice = writable<{ price: bigint; liquidity: bigint }>({
    price: 0n,
    liquidity: 0n,
  });
  getPoolStats(meme.pool_id, meme.decimals).then((stats) =>
    tokenPrice.set(stats),
  );

  return derived([nearPrice, tokenPrice], ([$nearPrice, $tokenPrice]) => {
    getNearPrice();
    const mcap = new FixedNumber(
      $tokenPrice.price * BigInt(meme.total_supply!),
      meme.decimals + 24,
    ).mul(new FixedNumber($nearPrice, 24));

    const liquidity = new FixedNumber($tokenPrice.liquidity, 24).mul(
      new FixedNumber($nearPrice, 24),
    );

    return { mcap, liquidity };
  });
}

export function projectedMCapFromPool(
  meme: Pick<Meme, "pool_id" | "total_supply" | "decimals">,
): Readable<FixedNumber> {
  if (!meme.pool_id) throw new Error();
  const tokenPrice = writable<bigint>(0n);
  getPoolStats(meme.pool_id, meme.decimals).then(({ price }) =>
    tokenPrice.set(price),
  );

  return derived([nearPrice, tokenPrice], ([$nearPrice, $tokenPrice]) => {
    getNearPrice();
    return new FixedNumber(
      $tokenPrice * BigInt(meme.total_supply!),
      meme.decimals + 24,
    ).mul(new FixedNumber($nearPrice, 24));
  });
}

export function projectedMCap(meme: Meme): Readable<FixedNumber> {
  if (meme.pool_id) {
    return projectedMCapFromPool(meme);
  } else {
    return derived(nearPrice, (price) => {
      getNearPrice();

      const pricePerTokenInNear = getProjectedMemePriceInNear(meme);
      const totalSupply = BigInt(meme.total_supply || 0);

      // Convert to USD using NEAR price and multiply by total supply
      return new FixedNumber(
        pricePerTokenInNear * totalSupply,
        24 + meme.decimals,
      ).mul(new FixedNumber(price, 24));
    });
  }
}

async function getPoolStats(
  poolId: number,
  decimals: number,
): Promise<{ price: bigint; liquidity: bigint }> {
  const pool = await Ref.getPool(poolId);

  const denomIdx = pool.token_account_ids.indexOf(
    import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID,
  );
  const tokenIdx = denomIdx === 0 ? 1 : 0;

  const denomAmount = pool.amounts[denomIdx];
  const tokenAmount = pool.amounts[tokenIdx];

  const price = new FixedNumber(BigInt(denomAmount), 24)
    .div(new FixedNumber(BigInt(tokenAmount), decimals))
    .toBigInt();

  // Liquidity is 2x the NEAR amount since it's a 50/50 pool
  const liquidity = BigInt(denomAmount) * 2n;

  return {
    price,
    liquidity,
  };
}

export const nearPrice = writable<bigint>(0n);

let cachePrice = { price: 0n, expiry: 0 };

export async function getNearPrice(): Promise<Writable<bigint>> {
  if (cachePrice.expiry > Date.now()) {
    nearPrice.set(cachePrice.price);
    return nearPrice;
  }

  try {
    // 4512 is the poolId for wrap.near/usd
    const { price: usdPerNear } = await getPoolStats(4512, 6);
    const price = (BigInt(1e24) * BigInt(1e24)) / BigInt(usdPerNear);

    cachePrice = {
      price,
      expiry: Date.now() + 1000 * 60 * 5,
    };
    nearPrice.set(cachePrice.price);
    return nearPrice;
  } catch (error) {
    if (cachePrice.price !== 0n) {
      nearPrice.set(cachePrice.price);
      return nearPrice;
    }
    throw error;
  }
}
