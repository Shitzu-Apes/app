import { derived, readable, type Readable } from "svelte/store";
import { match, P } from "ts-pattern";

import type { FungibleTokenMetadata } from "$lib/abi";
import BlackDragonLogo from "$lib/assets/logo/blackdragon.png";
import IntearLogo from "$lib/assets/logo/intear.jpeg";
import LonkLogo from "$lib/assets/logo/lonk.png";
import NDCLogo from "$lib/assets/logo/ndc.jpeg";
import PussyLogo from "$lib/assets/logo/pussy.webp";
import ShitzuLogo from "$lib/assets/logo/shitzu.webp";
import { Ft, Ref, type PoolInfo } from "$lib/near";

export type TokenInfo = {
  price?: string;
  decimal: number;
  symbol: string;
  icon: string | null | undefined;
};

type PoolConfig = {
  poolId: number;
  denom:
    | "wrap.near"
    | "blackdragon.tkn.near"
    | "ftv2.nekotoken.near"
    | "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1"
    | "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near";
};

// Define the poolIds type
type PoolIdsType = {
  "wrap.near": PoolConfig;
  "token.0xshitzu.near": PoolConfig;
  "blackdragon.tkn.near": PoolConfig;
  "token.lonkingnearbackto2024.near": PoolConfig;
  "intel.tkn.near": PoolConfig;
  "nearnvidia.near": PoolConfig;
  "ndc.tkn.near": PoolConfig;
  "avb.tkn.near": PoolConfig;
  "pussy.laboratory.jumpfinance.near": PoolConfig;
  "babyblackdragon.tkn.near": PoolConfig;
  "bean.tkn.near": PoolConfig;
  "slush.tkn.near": PoolConfig;
  "hat.tkn.near": PoolConfig;
  "ftv2.nekotoken.near": PoolConfig;
};

export type TokenId = keyof PoolIdsType;

// Define the poolIds object with type annotation
const poolIds: PoolIdsType = {
  "wrap.near": {
    poolId: 4512,
    denom: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
  },
  "token.0xshitzu.near": { poolId: 4369, denom: "wrap.near" },
  "blackdragon.tkn.near": { poolId: 4276, denom: "wrap.near" },
  "token.lonkingnearbackto2024.near": { poolId: 4314, denom: "wrap.near" },
  "intel.tkn.near": { poolId: 4663, denom: "wrap.near" },
  "nearnvidia.near": { poolId: 4547, denom: "wrap.near" },
  "ndc.tkn.near": { poolId: 4353, denom: "blackdragon.tkn.near" },
  "avb.tkn.near": { poolId: 20, denom: "wrap.near" },
  "pussy.laboratory.jumpfinance.near": { poolId: 4829, denom: "wrap.near" },
  "babyblackdragon.tkn.near": { poolId: 4840, denom: "wrap.near" },
  "bean.tkn.near": { poolId: 4473, denom: "ftv2.nekotoken.near" },
  "slush.tkn.near": { poolId: 4623, denom: "wrap.near" },
  "hat.tkn.near": { poolId: 5179, denom: "wrap.near" },
  "ftv2.nekotoken.near": {
    poolId: 3804,
    denom: "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near",
  },
};

export function getTokenSortIndex(tokenId: string): number {
  if (!isKeyOf(tokenSortIndex, tokenId)) {
    return 1_000;
  }
  return tokenSortIndex[tokenId];
}
const tokenSortIndex: Record<keyof PoolIdsType, number> = {
  "wrap.near": -1,
  "token.0xshitzu.near": 1_000,
  "blackdragon.tkn.near": 800,
  "token.lonkingnearbackto2024.near": 799,
  "intel.tkn.near": 600,
  "nearnvidia.near": 599,
  "ndc.tkn.near": 500,
  "avb.tkn.near": 300,
  "pussy.laboratory.jumpfinance.near": 299,
  "babyblackdragon.tkn.near": 298,
  "bean.tkn.near": 297,
  "slush.tkn.near": 296,
  "hat.tkn.near": 295,
  "ftv2.nekotoken.near": -1,
};

// Now define the refPrices$ with mutable keys and auto-completion
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
          } else if (token_id === "pussy.laboratory.jumpfinance.near") {
            meta.icon = PussyLogo;
          } else if (token_id === "intel.tkn.near") {
            meta.icon = IntearLogo;
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
      return fetch(
        `https://api.dexscreener.com/latest/dex/pairs/near/refv1-${poolIds[tokenId]}`,
      ).then(async (res) => {
        if (!res.ok) {
          return {
            price: "0",
            decimal: metadata.decimals,
            symbol: metadata.symbol,
            icon: metadata.icon,
          } satisfies TokenInfo;
        }
        const data = await res.json();
        try {
          return {
            price: data.pairs[0].priceUsd,
            decimal: metadata.decimals,
            symbol: metadata.symbol,
            icon: metadata.icon,
          } satisfies TokenInfo;
        } catch (err) {
          return {
            decimal: metadata.decimals,
            symbol: metadata.symbol,
            icon: metadata.icon,
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
  { name: "Intear", src: IntearLogo },
  { name: "NDC", src: NDCLogo },
];
