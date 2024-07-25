import { FixedNumber } from "./FixedNumber";

import type { Meme, Trade } from "$lib/api/client";

export function predictedTokenAmount(trade: Trade & Meme): number {
  const amount = BigInt(trade.amount);
  const totalDeposit = BigInt(trade.total_deposit);
  const totalSupply = BigInt(trade.total_supply ?? "10000000000");

  const result = (amount * totalSupply) / (totalDeposit * 2n);
  return new FixedNumber(result, 24).toNumber();
}
