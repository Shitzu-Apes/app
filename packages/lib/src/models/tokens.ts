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
  bnb?: FixedNumber;
};

export type Network = "near" | "solana" | EvmChain;
export type EvmChain = "ethereum" | "base" | "arbitrum" | "bnb";

export type TokenInfo = {
  price?: string;
  decimal: number;
  symbol: string;
  icon: string | null | undefined;
};

export type PoolConfig = {
  poolId: number;
  denom:
    | "wrap.near"
    | "blackdragon.tkn.near"
    | "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1"
    | "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near";
};

export type PoolIdsType = {
  "wrap.near": PoolConfig;
  "token.0xshitzu.near": PoolConfig;
  "jambo-1679.meme-cooking.near": PoolConfig;
  "blackdragon.tkn.near": PoolConfig;
  "token.lonkingnearbackto2024.near": PoolConfig;
  "hijack-252.meme-cooking.near": PoolConfig;
  "4illia-222.meme-cooking.near": PoolConfig;
  "gnear-229.meme-cooking.near": PoolConfig;
  "avb.tknx.near": PoolConfig;
  "crans.tkn.near": PoolConfig;
};

export type TokenId = keyof PoolIdsType;

export const poolIds: PoolIdsType = {
  "wrap.near": {
    poolId: 4512,
    denom: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
  },
  "token.0xshitzu.near": { poolId: 4369, denom: "wrap.near" },
  "jambo-1679.meme-cooking.near": { poolId: 6518, denom: "wrap.near" },
  "blackdragon.tkn.near": { poolId: 4276, denom: "wrap.near" },
  "token.lonkingnearbackto2024.near": { poolId: 4314, denom: "wrap.near" },
  "hijack-252.meme-cooking.near": { poolId: 5519, denom: "wrap.near" },
  "4illia-222.meme-cooking.near": { poolId: 5494, denom: "wrap.near" },
  "gnear-229.meme-cooking.near": { poolId: 5502, denom: "wrap.near" },
  "avb.tknx.near": { poolId: 5315, denom: "wrap.near" },
  "crans.tkn.near": { poolId: 5423, denom: "wrap.near" },
};
