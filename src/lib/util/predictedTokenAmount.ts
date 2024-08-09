import { FixedNumber } from "./FixedNumber";

export function predictedTokenAmount(data: {
  amount: string;
  total_deposit: string;
  total_supply?: string | null;
  decimals?: number;
}): number {
  const decimals = data.decimals ?? 18;
  console.log(data);
  const amount = BigInt(data.amount);
  const totalDeposit = BigInt(data.total_deposit);
  if (totalDeposit === 0n) {
    return 0;
  }
  const totalSupply = BigInt(
    data.total_supply ?? "1000000000000000000000000000",
  );

  const result = (amount * totalSupply) / (totalDeposit * 2n);
  return new FixedNumber(result, decimals).toNumber();
}
