import type { FixedNumber } from "$lib/util";

export interface Token {
  symbol: string;
  icon: string;
  pool_id?: number; // Optional Pool ID for price calculation (only for tokens with NEAR pools)
  decimals: Record<Network, number | undefined>;
  addresses: Record<Network, string | `0x${string}` | undefined>;
}

export type Balance = {
  near?: FixedNumber;
  solana?: FixedNumber;
  ethereum?: FixedNumber;
  base?: FixedNumber;
  arbitrum?: FixedNumber;
};

export type Network = "near" | "solana" | EvmChain;
export type EvmChain = "ethereum" | "base" | "arbitrum";
