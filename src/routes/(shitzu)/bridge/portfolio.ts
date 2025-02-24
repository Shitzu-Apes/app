import { derived, type Readable } from "svelte/store";
import { z } from "zod";

import { balances$, TOKENS } from "./tokens";

import { Ref } from "$lib/near";
import { FixedNumber } from "$lib/util";
import { getNearPrice } from "$lib/util/projectedMCap";

// Define the Balance type structure
interface Balance {
  near?: FixedNumber;
  solana?: FixedNumber;
  base?: FixedNumber;
  arbitrum?: FixedNumber;
  ethereum?: FixedNumber;
}

// Define TokenBalances type
type TokenBalances = Record<keyof typeof TOKENS, Balance>;

// Zod schema for token price data
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

// Fetch price data for a specific token
async function fetchTokenPrice(
  contractId: string,
  token: keyof typeof TOKENS,
): Promise<z.infer<typeof TokenPriceSchema> | null> {
  try {
    // Special case for NEAR token
    if (token === "NEAR") {
      const nearPriceValue = await getNearPrice();
      const nearPriceFixed = new FixedNumber(nearPriceValue, 24);
      const priceInUsd = nearPriceFixed.toNumber();

      return {
        price: priceInUsd,
        total_supply: "1000000000000000000000000000000", // 1B NEAR
        decimals: 24,
        symbol: "NEAR",
        name: "NEAR",
      };
    }

    // If token has no pool_id, it has no price
    if (!TOKENS[token].pool_id) {
      return null;
    }

    const pool = await Ref.getPool(TOKENS[token].pool_id!);
    const denomIdx = pool.token_account_ids.indexOf(
      import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID,
    );
    const tokenIdx = denomIdx === 0 ? 1 : 0;

    const denomAmount = pool.amounts[denomIdx];
    const tokenAmount = pool.amounts[tokenIdx];

    const price = new FixedNumber(BigInt(denomAmount), 24).div(
      new FixedNumber(BigInt(tokenAmount), TOKENS[token].decimals.near ?? 24),
    );

    // Get NEAR price in USD
    const nearPriceValue = await getNearPrice();
    const nearPriceFixed = new FixedNumber(nearPriceValue, 24);
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
}

// Fetch portfolio data for all bridge tokens
export async function fetchBridgePortfolio(): Promise<TokenPortfolio> {
  const tokens = await Promise.all(
    Object.entries(TOKENS).map(async ([tokenId, token]) => {
      const nearContractId = token.addresses.near;
      if (!nearContractId) return null;

      const priceData = await fetchTokenPrice(
        nearContractId,
        tokenId as keyof typeof TOKENS,
      );
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

// Create a derived store that combines balances with price data
export const bridgePortfolio$ = derived(
  Object.values(balances$),
  ($balances, set) => {
    // Convert array of balances back to record
    const balancesRecord = Object.fromEntries(
      Object.keys(TOKENS).map((key, i) => [key, $balances[i]]),
    ) as TokenBalances;

    fetchBridgePortfolio().then((prices) => {
      set({
        balances: balancesRecord,
        prices,
      });
    });

    return () => {
      // Cleanup function if needed
    };
  },
  {
    balances: {} as TokenBalances,
    prices: { tokens: [] as z.infer<typeof TokenSchema>[] },
  },
) satisfies Readable<{
  balances: TokenBalances;
  prices: TokenPortfolio;
}>;
