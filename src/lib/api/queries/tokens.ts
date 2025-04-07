import { createQueryKeys } from "@lukemorales/query-key-factory";
import { createQuery } from "@tanstack/svelte-query";
import { match, P } from "ts-pattern";

import { queryClient } from ".";

import type { FungibleTokenMetadata } from "$lib/abi";
import BlackDragonLogo from "$lib/assets/logo/blackdragon.webp";
import HijackLogo from "$lib/assets/logo/hijack.webp";
import LonkLogo from "$lib/assets/logo/lonk.png";
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
    | "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1"
    | "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near";
};

// Define the poolIds type
type PoolIdsType = {
  "wrap.near": PoolConfig;
  "token.0xshitzu.near": PoolConfig;
  "blackdragon.tkn.near": PoolConfig;
  "token.lonkingnearbackto2024.near": PoolConfig;
  "hijack-252.meme-cooking.near": PoolConfig;
  "4illia-222.meme-cooking.near": PoolConfig;
  "gnear-229.meme-cooking.near": PoolConfig;
  "avb.tknx.near": PoolConfig;
  "crans.tkn.near": PoolConfig;
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
  "hijack-252.meme-cooking.near": { poolId: 5519, denom: "wrap.near" },
  "4illia-222.meme-cooking.near": { poolId: 5494, denom: "wrap.near" },
  "gnear-229.meme-cooking.near": { poolId: 5502, denom: "wrap.near" },
  "avb.tknx.near": { poolId: 5315, denom: "wrap.near" },
  "crans.tkn.near": { poolId: 5423, denom: "wrap.near" },
};

/**
 * Calculate token price based on pool information
 * @param denomAmount The amount of the denominator token
 * @param tokenAmount The amount of the token
 * @param tokenDecimals The decimals of the token
 * @param denomDecimals The decimals of the denominator token
 * @returns Token price with the correct decimal adjustment
 */
export function calculateTokenPrice(
  denomAmount: string,
  tokenAmount: string,
  tokenDecimals: number,
  denomDecimals: number,
): number {
  return (+denomAmount * 10 ** (tokenDecimals - denomDecimals)) / +tokenAmount;
}

/**
 * Format token price to standard precision
 * @param price The price to format
 * @returns Formatted price as string
 */
export function formatTokenPrice(price: number): string {
  return price.toFixed(15);
}

export function getTokenSortIndex(tokenId: string): number {
  if (!isKeyOf(tokenSortIndex, tokenId)) {
    return -1;
  }
  return tokenSortIndex[tokenId];
}

const tokenSortIndex: Record<TokenId, number> = {
  "wrap.near": -1,
  "token.0xshitzu.near": 1_000,
  "blackdragon.tkn.near": 800,
  "token.lonkingnearbackto2024.near": 799,
  "hijack-252.meme-cooking.near": 700,
  "4illia-222.meme-cooking.near": 699,
  "gnear-229.meme-cooking.near": 698,
  "avb.tknx.near": 300,
  "crans.tkn.near": 299,
};

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

// Define query keys
export const tokensKeys = createQueryKeys("tokens", {
  all: () => ({
    queryKey: ["allTokens"],
    queryFn: async () => {
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
        }, {}) as Record<TokenId, FungibleTokenMetadata>;

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
          }, {}) as Record<TokenId, PoolInfo>;

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
          continue;
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
            () => {
              // These are USDT/USDC which have 6 decimals
              return calculateTokenPrice(
                denomAmount,
                tokenAmount,
                tokenDecimals,
                6,
              );
            },
          )
          .otherwise((denom) => {
            let denomDecimals = 24; // Default for wrap.near

            // Get actual decimals from metadata for better precision
            if (tokens_metadata[denom as keyof PoolIdsType]) {
              denomDecimals =
                tokens_metadata[denom as keyof PoolIdsType]!.decimals;
            }

            let price = calculateTokenPrice(
              denomAmount,
              tokenAmount,
              tokenDecimals,
              denomDecimals,
            );

            if (
              denom in refPrices &&
              refPrices[denom as keyof PoolIdsType]?.price
            ) {
              price *= +refPrices[denom as keyof PoolIdsType]!.price!;
            } else {
              // add back to the queue
              token_ids.push(token_id);
            }
            return price;
          });

        refPrices[token_id] = {
          price: formatTokenPrice(price),
          decimal: metadata.decimals,
          symbol: metadata.symbol,
          icon: metadata.icon as string,
        };
      }

      return refPrices as Record<TokenId, TokenInfo>;
    },
  }),
  tokenInfo: (tokenId: keyof PoolIdsType) => ({
    queryKey: [tokenId],
    queryFn: async () => {
      const metadata = await Ft.metadata(tokenId);

      if (tokenId === "blackdragon.tkn.near") {
        metadata.icon = BlackDragonLogo;
      }

      const refPrices = queryClient.getQueryData<Record<TokenId, TokenInfo>>(
        tokensKeys.all().queryKey,
      );

      if (refPrices && refPrices[tokenId] != null) {
        return {
          ...refPrices[tokenId]!,
        } as TokenInfo;
      }

      return fetch(
        `https://api.dexscreener.com/latest/dex/pairs/near/refv1-${poolIds[tokenId].poolId}`,
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
      });
    },
  }),
});

export function useTokenInfoQuery(tokenId: keyof PoolIdsType) {
  return createQuery({
    ...tokensKeys.tokenInfo(tokenId),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useAllTokensQuery() {
  return createQuery({
    ...tokensKeys.all(),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export const memes = [
  { name: "Shitzu", src: ShitzuLogo },
  { name: "BlackDragon", src: BlackDragonLogo },
  { name: "Lonk", src: LonkLogo },
  { name: "Hijack", src: HijackLogo },
];
