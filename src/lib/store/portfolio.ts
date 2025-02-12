import { derived, get, writable } from "svelte/store";
import { z } from "zod";

import { nearWallet } from "$lib/near/wallet";
import { memebids$ } from "$lib/store/memebids";
import { getTokenPrice, updateTokenPrice } from "$lib/util/projectedMCap";

// Zod schema for portfolio data validation
const TokenSchema = z.object({
  balance: z.string(),
  contract_id: z.string(),
  last_update_block_height: z.number().nullable(),
  price: z.number().nullable().optional(),
  meme_id: z.number().optional(),
  owner: z.string().optional(),
  end_timestamp_ms: z.number().nullable().optional(),
  name: z.string().optional(),
  symbol: z.string().optional(),
  decimals: z.number().optional(),
  total_supply: z.string().nullish().optional(),
  reference: z.string().nullable().optional(),
  reference_hash: z.string().nullable().optional(),
  deposit_token_id: z.string().nullable().optional(),
  pool_id: z.number().nullable().optional(),
  description: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
});

const PortfolioSchema = z.object({
  account_id: z.string(),
  tokens: z.array(TokenSchema),
});

export type Portfolio = z.infer<typeof PortfolioSchema>;

// Create writable store for portfolio data
const portfolioStore = writable<Portfolio | null>(null);

// Fetch and validate portfolio data
export async function fetchPortfolio(
  accountId: string,
): Promise<Portfolio | null> {
  console.log("fetching portfolio", accountId);
  try {
    const res = await fetch(
      `https://api.fastnear.com/v1/account/${accountId}/ft`,
    );
    const data = await res.json();
    const validated = PortfolioSchema.parse(data);

    // Get meme info from memebids store
    const memeMap = new Map(
      get(memebids$).map((meme) => [meme.token_id, meme]),
    );

    // Add price info to tokens
    const tokensWithPrice = await Promise.all(
      validated.tokens.map(async (token) => {
        // Check if token is in meme map
        const meme = memeMap.get(token.contract_id);

        if (meme) {
          try {
            // Use centralized token price store
            const price = get(getTokenPrice(meme));
            if (price === null) {
              // If price not in store, update it
              await updateTokenPrice(meme);
            }
            return {
              ...token,
              ...meme,
              price: get(getTokenPrice(meme))?.toNumber() || null,
            };
          } catch (err) {
            console.error(
              `Failed to get price for token ${token.contract_id}`,
              err,
            );
            return {
              ...token,
              price: null,
            };
          }
        }

        return {
          ...token,
          price: null,
        };
      }),
    );

    return {
      ...validated,
      tokens: tokensWithPrice,
    };
  } catch (err) {
    console.error(
      err instanceof Error ? err.message : "Failed to fetch portfolio",
    );
    return null;
  }
}

// Derived store that updates when account changes
export const portfolio$ = derived(nearWallet.accountId$, ($accountId, set) => {
  if (!$accountId) {
    set(null);
    return;
  }

  fetchPortfolio($accountId).then(set);
});

// Helper function to manually refresh portfolio
export function refreshPortfolio() {
  const accountId = get(nearWallet.accountId$);
  if (!accountId) return;

  fetchPortfolio(accountId).then(portfolioStore.set);
}
