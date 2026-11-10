import { FixedNumber } from "$lib/util/FixedNumber";

export type StorageBalance = { total: string; available: string } | null;
export type StorageCosts = { account: string; perMemeDeposit: string };
export type StorageDeposit = { depositAmount: string };

export type ReferrerBalance =
  | { known: true; balance: StorageBalance }
  | { known: false };

export type DepositPlan = {
  steps: string[];
  referrer: string | undefined;
  referralRejected: boolean;
  needStorageDeposit: StorageDeposit | null;
  wrapNearDeposit: StorageDeposit | null;
  extraNearDeposit: bigint;
};

export type DepositPlanInput = {
  accountId: string;
  referral: string | null;
  storageBalance: StorageBalance;
  storageCosts: StorageCosts;
  wrapNearRegistered: boolean;
  wrapNearMinDeposit: string;
  referrerBalance: ReferrerBalance;
  input: FixedNumber;
  wrapNearBalance: FixedNumber | undefined;
  memeSymbol: string;
};

/**
 * Everything the deposit transaction needs, derived from query results that
 * already loaded.
 *
 * `storageBalance === null` (account not registered on the contract) and
 * `wrapNearRegistered === false` are answers, not failures: they are the states
 * that get a storage deposit folded into the same transaction. Only call this
 * once the queries have settled, otherwise null/false cannot be told apart from
 * missing data.
 */
export function buildDepositPlan({
  accountId,
  referral,
  storageBalance,
  storageCosts,
  wrapNearRegistered,
  wrapNearMinDeposit,
  referrerBalance,
  input,
  wrapNearBalance,
  memeSymbol,
}: DepositPlanInput): DepositPlan {
  const { account: accountCost, perMemeDeposit } = storageCosts;

  const needsRegistration =
    storageBalance === null ||
    new FixedNumber(storageBalance.available).toBigInt() <
      new FixedNumber(accountCost).toBigInt();
  const needsTopUp =
    storageBalance !== null &&
    BigInt(storageBalance.available) < BigInt(perMemeDeposit);

  let needStorageDeposit: StorageDeposit | null = null;
  if (needsRegistration) {
    needStorageDeposit = {
      depositAmount: (
        BigInt(accountCost) +
        5n * BigInt(perMemeDeposit)
      ).toString(),
    };
  } else if (needsTopUp) {
    needStorageDeposit = {
      depositAmount: (5n * BigInt(perMemeDeposit)).toString(),
    };
  }

  const wrapNearDeposit: StorageDeposit | null = wrapNearRegistered
    ? null
    : { depositAmount: wrapNearMinDeposit };

  const extraNearDeposit =
    input.toBigInt() > (wrapNearBalance?.toBigInt() ?? 0n)
      ? input.toBigInt() - (wrapNearBalance?.toBigInt() ?? 0n)
      : 0n;

  const steps: string[] = [];
  let referrer = referral ?? undefined;
  let referralRejected = false;

  if (referrer) {
    if (referrer === accountId) {
      referrer = undefined;
      referralRejected = true;
      steps.push(
        "⚠️ Referral cannot be the same as depositor - referral will be ignored",
      );
    } else if (referrerBalance.known && referrerBalance.balance === null) {
      referrer = undefined;
      referralRejected = true;
      steps.push("⚠️ Referral not registered - referral will be ignored");
    } else if (!referrerBalance.known) {
      // The referrer query failed: dropping the referral is safe, sending one
      // the contract may not know is not.
      referrer = undefined;
    }
  }

  if (needsRegistration) {
    steps.push(
      `Register account with storage deposit of ${new FixedNumber(
        needStorageDeposit!.depositAmount,
        24,
      ).format()} NEAR`,
    );
  } else if (needsTopUp) {
    steps.push(
      `Add storage deposit of ${new FixedNumber(
        needStorageDeposit!.depositAmount,
        24,
      ).format()} NEAR`,
    );
  }

  if (wrapNearDeposit) {
    steps.push(
      `Register wNEAR token (${new FixedNumber(
        wrapNearDeposit.depositAmount,
        24,
      ).format()} NEAR)`,
    );
  }

  if (extraNearDeposit > 0n) {
    steps.push(
      `Wrap ${new FixedNumber(extraNearDeposit.toString(), 24).format()} NEAR to wNEAR`,
    );
  }

  steps.push(`Deposit ${input.format()} NEAR to $${memeSymbol}`);

  return {
    steps,
    referrer,
    referralRejected,
    needStorageDeposit,
    wrapNearDeposit,
    extraNearDeposit,
  };
}
