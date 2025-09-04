import { createQueryKeys } from "@lukemorales/query-key-factory";
import { createQuery } from "@tanstack/svelte-query";
import { derived, type Readable } from "svelte/store";
import { z } from "zod";

import { balances$, TOKENS } from "./tokens";

import { queryClient } from "$lib/api/queries";
import { priceQueryFactory } from "$lib/api/queries/prices";
import { ref } from "$lib/api/queries/ref";
import type { PoolInfo } from "$lib/near/ref";
import { FixedNumber } from "$lib/util";

interface Balance {
  near?: FixedNumber;
  solana?: FixedNumber;
  base?: FixedNumber;
  arbitrum?: FixedNumber;
  ethereum?: FixedNumber;
}

type TokenBalances = Record<keyof typeof TOKENS, Balance>;

const TokenPriceSchema = z.object({
  price: z.number().nullable(),
  total_supply: z.string().nullable(),
  name: z.string().optional(),
  symbol: z.string().optional(),
  decimals: z.number().optional(),
});

const TokenSchema = z.object({
  contract_id: z.string(),
  price: z.number().nullable(),
  total_supply: z.string().nullable(),
  symbol: z.string().optional(),
  name: z.string().optional(),
  decimals: z.number().optional(),
});

const PortfolioSchema = z.object({
  tokens: z.array(TokenSchema),
});

export type TokenPortfolio = z.infer<typeof PortfolioSchema>;

export const bridgeTokenPriceKeys = createQueryKeys("bridgeTokenPrice", {
  tokenPrice: (token: keyof typeof TOKENS) => ({
    queryKey: [{ token }],
    queryFn: async (): Promise<z.infer<typeof TokenPriceSchema> | null> => {
      console.log(`[bridgeTokenPriceQuery] ${token}`);
      try {
        if (token === "NEAR") {
          const nearPriceQuery = priceQueryFactory.nearPrice.detail();
          let nearPriceFixed: FixedNumber;
          const cachedNearPrice = queryClient.getQueryData(
            nearPriceQuery.queryKey,
          );
          if (cachedNearPrice) {
            nearPriceFixed = cachedNearPrice as FixedNumber;
          } else {
            nearPriceFixed = await queryClient.fetchQuery(nearPriceQuery);
          }

          const priceInUsd = nearPriceFixed.toNumber();

          return {
            price: priceInUsd,
            total_supply: "1000000000000000000000000000000",
            decimals: 24,
            symbol: "NEAR",
            name: "NEAR",
          };
        }

        if (!TOKENS[token].pool_id) {
          return null;
        }

        const poolId = TOKENS[token].pool_id!;
        const poolQuery = ref.detail(poolId);

        let pool: PoolInfo;
        const cachedPool = queryClient.getQueryData(poolQuery.queryKey);
        if (cachedPool) {
          pool = cachedPool as PoolInfo;
        } else {
          pool = await queryClient.fetchQuery(poolQuery);
        }

        const denomIdx = pool.token_account_ids.indexOf(
          import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID,
        );
        const tokenIdx = denomIdx === 0 ? 1 : 0;

        const denomAmount = pool.amounts[denomIdx];
        const tokenAmount = pool.amounts[tokenIdx];

        const price = new FixedNumber(BigInt(denomAmount), 24).div(
          new FixedNumber(
            BigInt(tokenAmount),
            TOKENS[token].decimals.near ?? 24,
          ),
        );

        const nearPriceQuery = priceQueryFactory.nearPrice.detail();
        let nearPriceFixed: FixedNumber;

        const cachedNearPrice = queryClient.getQueryData(
          nearPriceQuery.queryKey,
        );
        if (cachedNearPrice) {
          nearPriceFixed = cachedNearPrice as FixedNumber;
        } else {
          nearPriceFixed = await queryClient.fetchQuery(nearPriceQuery);
        }

        const priceInUsd = price.mul(nearPriceFixed).toNumber();

        return {
          price: priceInUsd,
          total_supply: tokenAmount,
          decimals: TOKENS[token].decimals.near,
          symbol: TOKENS[token].symbol,
          name: TOKENS[token].symbol,
        };
      } catch (err) {
        console.error(`Failed to fetch price for ${token}:`, err);
        return null;
      }
    },
  }),
});

export function createBridgeTokenPriceQuery(token: keyof typeof TOKENS) {
  return createQuery({
    ...bridgeTokenPriceKeys.tokenPrice(token),
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 5,
  });
}

export async function fetchBridgePortfolio(): Promise<TokenPortfolio> {
  console.log(`[fetchBridgePortfolio]`);
  const tokens = await Promise.all(
    Object.entries(TOKENS).map(async ([tokenId, token]) => {
      const nearContractId = token.addresses.near;
      if (!nearContractId) return null;

      const priceQuery = bridgeTokenPriceKeys.tokenPrice(
        tokenId as keyof typeof TOKENS,
      );
      let priceData: z.infer<typeof TokenPriceSchema> | null;

      const cachedPrice = queryClient.getQueryData(priceQuery.queryKey);
      if (cachedPrice) {
        priceData = cachedPrice as z.infer<typeof TokenPriceSchema> | null;
      } else {
        priceData = await queryClient.fetchQuery(priceQuery);
      }

      if (!priceData) return null;

      return TokenSchema.parse({
        contract_id: nearContractId,
        price: priceData.price,
        total_supply: priceData.total_supply,
        symbol: token.symbol,
        name: priceData.name,
        decimals: priceData.decimals,
      });
    }),
  );

  return {
    tokens: tokens.filter((t): t is NonNullable<typeof t> => t !== null),
  };
}

export const bridgePortfolio$ = derived(
  Object.values(balances$),
  ($balances, set) => {
    const balancesRecord = Object.fromEntries(
      Object.keys(TOKENS).map((key, i) => [key, $balances[i]]),
    ) as TokenBalances;

    fetchBridgePortfolio().then((prices) => {
      set({
        balances: balancesRecord,
        prices,
      });
    });

    return () => {};
  },
  {
    balances: {} as TokenBalances,
    prices: { tokens: [] as z.infer<typeof TokenSchema>[] },
  },
) satisfies Readable<{
  balances: TokenBalances;
  prices: TokenPortfolio;
}>;
