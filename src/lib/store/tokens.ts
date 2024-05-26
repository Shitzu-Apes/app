import { derived, readable, type Readable } from "svelte/store";

import type { FungibleTokenMetadata } from "$lib/abi";
import BlackDragonLogo from "$lib/assets/logo/blackdragon.png";
import { view } from "$lib/near/utils";

export type TokenInfo = {
  price: string;
  decimal: number;
  symbol: string;
  icon: string | null | undefined;
};

type PoolConfig = {
  poolId: number;
  denom:
    | "wrap.near"
    | "blackdragon.tkn.near"
    | "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";
};

/**
 *  /// Pool kind.
    pub pool_kind: String,
    /// List of tokens in the pool.
    pub token_account_ids: Vec<AccountId>,
    /// How much NEAR this contract has.
    pub amounts: Vec<U128>,
    /// Fee charged for swap.
    pub total_fee: u32,
    /// Total number of shares.
    pub shares_total_supply: U128,
    pub amp: u64,
 */
export type PoolInfo = {
  pool_kind: string;
  token_account_ids: string[];
  amounts: string[];
  total_fee: number;
  shares_total_supply: string;
  amp: number;
};

// Define the poolIds type
type PoolIdsType = {
  "wrap.near": PoolConfig;
  "token.0xshitzu.near": PoolConfig;
  "blackdragon.tkn.near": PoolConfig;
  "ndc.tkn.near": PoolConfig;
  "intel.tkn.near": PoolConfig;
  "token.lonkingnearbackto2024.near": PoolConfig;
  "avb.tkn.near": PoolConfig;
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
  "ndc.tkn.near": { poolId: 4353, denom: "blackdragon.tkn.near" },
  "intel.tkn.near": { poolId: 4663, denom: "wrap.near" },
  "token.lonkingnearbackto2024.near": { poolId: 4314, denom: "wrap.near" },
  "avb.tkn.near": { poolId: 20, denom: "wrap.near" },
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
        return fetchMetadata(token_id);
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

    const tokens_pool = await view("v2.ref-finance.near", "get_pool_by_ids", {
      pool_ids,
    }).then((pools: PoolInfo[]) => {
      const prices = pools.reduce<{
        [K in keyof PoolIdsType]?: PoolInfo;
      }>((acc, pool, i) => {
        const poolId = Object.keys(poolIds)[i] as keyof PoolIdsType;

        acc[poolId] = pool;

        return acc;
      }, {}) as Record<keyof PoolIdsType, PoolInfo>;

      return prices;
    });

    const refPrices: {
      [K in keyof PoolIdsType]?: TokenInfo;
    } = {};

    for (const token_id of token_ids) {
      const pool = tokens_pool[token_id];
      const metadata = tokens_metadata[token_id];
      const config = poolIds[token_id];
      if (!pool || !metadata || !config) {
        continue;
      }

      const denomIdx = pool.token_account_ids.indexOf(config.denom);
      const tokenIdx = denomIdx === 0 ? 1 : 0;

      const denomAmount = pool.amounts[denomIdx];
      const tokenAmount = pool.amounts[tokenIdx];

      const denomDecimals =
        config.denom ===
        "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1"
          ? 6
          : tokens_metadata[config.denom]!.decimals;
      const tokenDecimals = metadata.decimals;

      let price =
        (+denomAmount * 10 ** (tokenDecimals - denomDecimals)) / +tokenAmount;

      if (config.denom === "wrap.near") {
        // wrap near price should exist by now
        if ("wrap.near" in refPrices) {
          price = +price * +refPrices["wrap.near"]!.price;
        } else {
          // add back to the queue
          token_ids.push(token_id);
        }
      } else if (config.denom === "blackdragon.tkn.near") {
        // blackdragon price should exist by now
        if ("blackdragon.tkn.near" in refPrices) {
          price = +price * +refPrices["blackdragon.tkn.near"]!.price;
        } else {
          // add back to the queue
          token_ids.push(token_id);
        }
      }

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

const tokenPrices: {
  [K in keyof PoolIdsType]?: Readable<Promise<TokenInfo>>;
} = {};

const isKeyOf = <ObjectType extends Record<PropertyKey, unknown>>(
  object: ObjectType,
  property: PropertyKey,
): property is keyof ObjectType => {
  return Object.prototype.hasOwnProperty.call(object, property);
};

export function getToken$(tokenId: string): Readable<Promise<TokenInfo>> {
  if (!isKeyOf(poolIds, tokenId)) {
    throw new Error("Invalid token id");
  }

  if (tokenPrices[tokenId] == null) {
    tokenPrices[tokenId] = derived(refPrices$, async (r) => {
      const refPrices = await r;
      const metadata = await fetchMetadata(tokenId);
      if (!metadata) {
        throw new Error();
      }
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
            price: "0",
            decimal: metadata.decimals,
            symbol: metadata.symbol,
            icon: metadata.icon,
          } satisfies TokenInfo;
        }
      }) as Promise<TokenInfo>;
    });
  }
  return tokenPrices[tokenId]!;
}

export function getToken(tokenId: string) {
  if (!isKeyOf(poolIds, tokenId)) {
    throw new Error("Invalid token id");
  }

  return new Promise<TokenInfo>((resolve) => {
    getToken$(tokenId).subscribe((token) => {
      return resolve(token);
    });
  });
}

async function fetchMetadata(
  tokenId: string,
): Promise<FungibleTokenMetadata | undefined> {
  const nep141Metadata = await view(tokenId, "ft_metadata", {});
  return nep141Metadata;
}
