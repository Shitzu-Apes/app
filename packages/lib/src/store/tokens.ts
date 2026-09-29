import { derived, readable, type Readable } from "svelte/store";
import { match, P } from "ts-pattern";

import type { FungibleTokenMetadata } from "$lib/abi";
import BlackDragonLogo from "$lib/assets/logo/blackdragon.webp";
import HijackLogo from "$lib/assets/logo/hijack.webp";
import LonkLogo from "$lib/assets/logo/lonk.png";
import ShitzuLogo from "$lib/assets/logo/shitzu.webp";
import { poolIds, type PoolIdsType, type TokenInfo } from "$lib/models/tokens";
import { Ft, Ref, type PoolInfo } from "$lib/near";

export function getTokenSortIndex(tokenId: string): number {
  if (!isKeyOf(tokenSortIndex, tokenId)) {
    return -1;
  }
  return tokenSortIndex[tokenId];
}
const tokenSortIndex: Record<keyof PoolIdsType, number> = {
  "wrap.near": -1,
  "token.0xshitzu.near": 1_000,
  "jambo-1679.meme-cooking.near": 801,
  "blackdragon.tkn.near": 800,
  "token.lonkingnearbackto2024.near": 799,
  "hijack-252.meme-cooking.near": 700,
  "4illia-222.meme-cooking.near": 699,
  "gnear-229.meme-cooking.near": 698,
  "avb.tknx.near": 300,
  "crans.tkn.near": 299,
};

const refPrices$ = readable<
  Promise<{
    [K in keyof PoolIdsType]: TokenInfo;
  }>
>(new Promise<never>(() => {}), (set) => {
  const interval = setInterval(() => {
    fetchRefPool();
  }, 30_000);

  fetchRefPool();

  async function fetchRefPool() {
    const pool_ids = Object.values(poolIds).map((pool) => pool.poolId);

    const token_ids = Object.keys(poolIds) as (keyof PoolIdsType)[];

    const tokens_metadata = await Promise.all(
      token_ids.map((token_id) => {
        return Ft.metadata(token_id);
      }),
    ).then((metadata) => {
      const res = metadata.reduce<{
        [K in keyof PoolIdsType]?: FungibleTokenMetadata;
      }>((acc, meta, i) => {
        if (meta) {
          const token_id = token_ids[i] as keyof PoolIdsType;
          if (token_id === "blackdragon.tkn.near") {
            meta.icon = BlackDragonLogo;
          }
          acc[token_id] = meta;
        }
        return acc;
      }, {}) as Record<keyof PoolIdsType, FungibleTokenMetadata>;

      return res;
    });

    const tokens_pool = await Ref.getPoolByIds(pool_ids).then(
      (pools: PoolInfo[]) => {
        const prices = pools.reduce<{
          [K in keyof PoolIdsType]?: PoolInfo;
        }>((acc, pool, i) => {
          const poolId = Object.keys(poolIds)[i] as keyof PoolIdsType;

          acc[poolId] = pool;

          return acc;
        }, {}) as Record<keyof PoolIdsType, PoolInfo>;

        return prices;
      },
    );

    const refPrices: {
      [K in keyof PoolIdsType]?: TokenInfo;
    } = {};

    for (const token_id of token_ids) {
      const pool = tokens_pool[token_id];
      const metadata = tokens_metadata[token_id];
      const config = poolIds[token_id];
      if (!metadata || !config) {
        continue;
      }
      if (!pool) {
        refPrices[token_id] = {
          decimal: metadata.decimals,
          symbol: metadata.symbol,
          icon: metadata.icon as string,
        };
      }

      const denomIdx = pool.token_account_ids.indexOf(config.denom);
      const tokenIdx = denomIdx === 0 ? 1 : 0;

      const denomAmount = pool.amounts[denomIdx];
      const tokenAmount = pool.amounts[tokenIdx];

      const tokenDecimals = metadata.decimals;
      const price = match(config.denom)
        .with(
          P.union(
            "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
            "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near",
          ),
          () => (+denomAmount * 10 ** (tokenDecimals - 6)) / +tokenAmount,
        )
        .otherwise((denom) => {
          const denomDecimals =
            tokens_metadata[config.denom as keyof PoolIdsType]!.decimals;
          let price =
            (+denomAmount * 10 ** (tokenDecimals - denomDecimals)) /
            +tokenAmount;
          if (denom in refPrices) {
            price *= +refPrices[denom]!.price!;
          } else {
            // add back to the queue
            token_ids.push(token_id);
          }
          return price;
        });

      refPrices[token_id] = {
        price: price.toFixed(15),
        decimal: metadata.decimals,
        symbol: metadata.symbol,
        icon: metadata.icon as string,
      };
    }

    set(Promise.resolve(refPrices as Record<keyof PoolIdsType, TokenInfo>));
  }

  return () => clearInterval(interval);
});

const tokenInfos: {
  [K in keyof PoolIdsType]?: Readable<Promise<TokenInfo>>;
} = {};

const isKeyOf = <ObjectType extends Record<PropertyKey, unknown>>(
  object: ObjectType,
  property: PropertyKey,
): property is keyof ObjectType => {
  return Object.prototype.hasOwnProperty.call(object, property);
};

export const isTokenId = (tokenId: string) => {
  if (!isKeyOf(poolIds, tokenId)) {
    console.warn(`Invalid token id: ${tokenId}`);
  }
  return tokenId as keyof PoolIdsType;
};

export function getToken$(
  tokenId: keyof PoolIdsType,
): Readable<Promise<TokenInfo>> {
  if (tokenInfos[tokenId] == null) {
    tokenInfos[tokenId] = derived(refPrices$, async (r) => {
      const refPrices = await r;
      const metadata = await Ft.metadata(tokenId);
      if (tokenId === "blackdragon.tkn.near") {
        metadata.icon = BlackDragonLogo;
      }
      if (refPrices[tokenId] != null) {
        return {
          ...refPrices[tokenId]!,
        } as TokenInfo;
      }
      if (!poolIds[tokenId]) {
        return {
          price: "0",
          decimal: metadata?.decimals ?? 0,
          symbol: metadata?.symbol ?? "",
          icon: metadata?.icon ?? null,
        } satisfies TokenInfo;
      }
      return fetch(
        `https://api.dexscreener.com/latest/dex/pairs/near/refv1-${poolIds[tokenId].poolId}`,
      ).then(async (res) => {
        if (!res.ok) {
          return {
            price: "0",
            decimal: metadata?.decimals ?? 0,
            symbol: metadata?.symbol ?? "",
            icon: metadata?.icon ?? null,
          } satisfies TokenInfo;
        }
        const data = await res.json();
        try {
          return {
            price: data.pairs[0].priceUsd,
            decimal: metadata?.decimals ?? 0,
            symbol: metadata?.symbol ?? "",
            icon: metadata?.icon ?? null,
          } satisfies TokenInfo;
        } catch (err) {
          return {
            decimal: metadata?.decimals ?? 0,
            symbol: metadata?.symbol ?? "",
            icon: metadata?.icon ?? null,
          } satisfies TokenInfo;
        }
      }) as Promise<TokenInfo>;
    });
  }
  return tokenInfos[tokenId]!;
}

export function getToken(tokenId: string) {
  return new Promise<TokenInfo>((resolve) => {
    getToken$(isTokenId(tokenId)).subscribe((token) => {
      return resolve(token);
    });
  });
}

export const memes = [
  { name: "Shitzu", src: ShitzuLogo },
  { name: "BlackDragon", src: BlackDragonLogo },
  { name: "Lonk", src: LonkLogo },
  { name: "Hijack", src: HijackLogo },
];
