import { derived, writable, type Readable, type Writable } from "svelte/store";

import { FixedNumber } from "./FixedNumber";

import type { Meme } from "$lib/api/client";

export function projectedMCap(meme: Meme): Readable<FixedNumber> {
  return derived(nearPrice, (price) => {
    getNearPrice();
    return new FixedNumber(BigInt(meme.total_deposit), 24).mul(
      new FixedNumber(price, 24),
    );
  });
}

export const nearPrice = writable<bigint>(0n);

let cachePrice = { price: 0n, expiry: 0 };
let fetchPromise: Promise<Response> | null = null;

export async function getNearPrice(): Promise<Writable<bigint>> {
  if (cachePrice.expiry > Date.now()) {
    nearPrice.set(cachePrice.price);
    return nearPrice;
  }

  try {
    if (!fetchPromise) {
      fetchPromise = fetch(
        `https://api.dexscreener.com/latest/dex/pairs/near/refv1-4512`,
      );
    }

    const response = await fetchPromise;
    fetchPromise = null;

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    cachePrice = {
      price: BigInt(1e24 / parseFloat(data.pair.priceNative)),
      expiry: Date.now() + 1000 * 60 * 5,
    };
    nearPrice.set(cachePrice.price);
    return nearPrice;
  } catch (error) {
    console.error("Failed to fetch NEAR price:", error);
    if (cachePrice.price !== 0n) {
      nearPrice.set(cachePrice.price);
      return nearPrice;
    }
    throw error;
  }
}
