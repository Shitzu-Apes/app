import type { Meme } from "$lib/api/client";

export function getProjectedMemePriceInNear(meme: Meme): bigint {
  // Calculate liquidity pool allocation (delta = 1/1.98 of non-team allocation)
  const delta = 1 / 1.98;
  const teamAllocationBps =
    (Number(meme.team_allocation) || 0) / (Number(meme.total_supply) || 1);
  const teamAllocationPercent = teamAllocationBps;
  const nonTeamAllocationPercent = 1 - teamAllocationPercent;
  const liquidityPoolPercent = nonTeamAllocationPercent * delta;

  // Calculate number of tokens in liquidity pool
  const totalSupply = BigInt(meme.total_supply || 0);
  const tokensInLiquidityPool =
    (totalSupply * BigInt(Math.floor(liquidityPoolPercent * 10000))) / 10000n;

  // Calculate NEAR in liquidity pool (total deposits)
  const nearInLiquidityPool =
    (BigInt(meme.total_deposit!) * BigInt(98)) / BigInt(100);

  // Calculate price per token in NEAR
  const pricePerTokenInNear =
    nearInLiquidityPool === 0n
      ? 0n
      : (nearInLiquidityPool * BigInt(10 ** meme.decimals)) /
        tokensInLiquidityPool;

  return pricePerTokenInNear;
}
