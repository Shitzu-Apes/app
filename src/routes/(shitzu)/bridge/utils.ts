import type { TokenPortfolio } from "./portfolio";
import { TOKENS } from "./tokens";

// Helper function to get token price from portfolio
export function getTokenPrice(
  tokenId: keyof typeof TOKENS,
  portfolio: TokenPortfolio,
): number | null {
  const token = portfolio.tokens.find(
    (t) => t.contract_id === TOKENS[tokenId].addresses.near,
  );
  return token?.price ?? null;
}
