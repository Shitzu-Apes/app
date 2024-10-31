import type { Meme } from "$lib/api/client";
import { FixedNumber } from "$lib/util";

export function createProgressBarData(meme: Meme) {
  const softCap = new FixedNumber(meme.soft_cap, 24);
  const hardCap = meme.hard_cap ? new FixedNumber(meme.hard_cap, 24) : null;
  const totalDeposit = new FixedNumber(meme.total_deposit, 24);

  const progress = hardCap
    ? meme.total_deposit_num / meme.hard_cap_num!
    : meme.total_deposit_num / meme.soft_cap_num!;

  const softcapProgress = meme.total_deposit_num / meme.soft_cap_num!;

  const hardCapProgress =
    hardCap && hardCap.valueOf() !== softCap.valueOf()
      ? Number(
          ((meme.total_deposit_num - meme.soft_cap_num!) * 10000) /
            (meme.hard_cap_num! - meme.soft_cap_num!),
        ) / 10000
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
