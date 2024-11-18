import type { Meme } from "$lib/api/client";
import { FixedNumber } from "$lib/util";

export function createProgressBarData(meme: Meme) {
  const softCap = new FixedNumber(meme.soft_cap, 24);
  const hardCap = meme.hard_cap ? new FixedNumber(meme.hard_cap, 24) : null;
  const totalDeposit = new FixedNumber(meme.total_deposit, 24);

  const progress = hardCap
    ? Number(meme.total_deposit) / Number(meme.hard_cap!)
    : Number(meme.total_deposit) / Number(meme.soft_cap!);

  const softcapProgress = Number(meme.total_deposit) / Number(meme.soft_cap!);

  const hardCapProgress =
    hardCap && hardCap.valueOf() !== softCap.valueOf()
      ? ((Number(meme.total_deposit) - Number(meme.soft_cap!)) * 10_000) /
        (Number(meme.hard_cap!) - Number(meme.soft_cap!)) /
        10000
      : 0;

  const softHardCapRatio = hardCap ? softCap.div(hardCap).toNumber() : 0;

  const animatedWidth = Math.min(progress, 1.2);

  const explosionDelay = 2000 / Math.min(progress, 1.2) - 300;

  return {
    softCap,
    hardCap,
    totalDeposit,
    progress,
    softcapProgress,
    hardCapProgress,
    softHardCapRatio,
    animatedWidth,
    explosionDelay,
  };
}
