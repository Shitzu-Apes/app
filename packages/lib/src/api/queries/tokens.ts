import { createQueryKeys } from "@lukemorales/query-key-factory";
import { createQuery } from "@tanstack/svelte-query";
import { match, P } from "ts-pattern";

import { queryClient } from ".";

import type { FungibleTokenMetadata } from "$lib/abi";
import BlackDragonLogo from "$lib/assets/logo/blackdragon.webp";
import HijackLogo from "$lib/assets/logo/hijack.webp";
import LonkLogo from "$lib/assets/logo/lonk.png";
import ShitzuLogo from "$lib/assets/logo/shitzu.webp";
import {
  poolIds,
  type PoolIdsType,
  type TokenId,
  type TokenInfo,
} from "$lib/models/tokens";
import { Ft, Ref, type PoolInfo } from "$lib/near";

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
  tokenMetadata: (tokenId: keyof PoolIdsType) => ({
    queryKey: [`${tokenId}_metadata`],
    queryFn: async () => {
      const metadata = await Ft.metadata(tokenId);

      if (tokenId === "blackdragon.tkn.near") {
        metadata.icon = BlackDragonLogo;
      }

      return {
        decimal: metadata.decimals,
        symbol: metadata.symbol,
        icon: metadata.icon,
      } as Omit<TokenInfo, "price">;
    },
  }),
  tokenPrice: (tokenId: keyof PoolIdsType) => ({
    queryKey: [`${tokenId}_price`],
    queryFn: async () => {
      const refPrices = queryClient.getQueryData<Record<TokenId, TokenInfo>>(
        tokensKeys.all().queryKey,
      );

      console.log("refPrices", tokenId, refPrices);
      if (
        refPrices &&
        refPrices[tokenId] != null &&
        refPrices[tokenId]!.price
      ) {
        return refPrices[tokenId]!.price;
      }

      return fetch(
        `https://api.dexscreener.com/latest/dex/pairs/near/refv1-${poolIds[tokenId].poolId}`,
      ).then(async (res) => {
        if (!res.ok) {
          return undefined;
        }
        const data = await res.json();
        console.log("data", tokenId, data);
        try {
          return data.pairs[0].priceUsd;
        } catch (err) {
          console.error("Error fetching token price:", err);
          return undefined;
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

// New hook for fetching only token metadata
export function useTokenMetadataQuery(tokenId: keyof PoolIdsType) {
  return createQuery({
    ...tokensKeys.tokenMetadata(tokenId),
    staleTime: 5 * 60 * 1000, // 5 minutes as metadata changes rarely
  });
}

// New hook for fetching only token price
export function useTokenPriceQuery(tokenId: keyof PoolIdsType) {
  return createQuery({
    ...tokensKeys.tokenPrice(tokenId),
    staleTime: 30 * 1000, // 30 seconds
  });
}
