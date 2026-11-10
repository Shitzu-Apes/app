import assert from "node:assert/strict";
import test from "node:test";

const { buildDepositPlan } = await import(
  "../src/components/memecooking/Board/depositPlan.ts"
);
const { FixedNumber } = await import("../src/util/FixedNumber.ts");

const ACC = "marior.near";
const REF = "referrer.near";
/** 0.1 NEAR in yoctoNEAR. */
const ACCOUNT_COST = "100000000000000000000000";
/** 0.005 NEAR in yoctoNEAR. */
const PER_MEME = "5000000000000000000000";
/** `storage_balance_bounds.min` on wrap.near, as the contract returns it. */
const WRAP_MIN = "1250000000000000000000";
const ONE_NEAR = new FixedNumber(10n ** 24n, 24);

const costs = { account: ACCOUNT_COST, perMemeDeposit: PER_MEME };

/** A registered account with room for another meme. */
const plenty = {
  total: "1000000000000000000000000",
  available: "1000000000000000000000000",
};

const base = {
  accountId: ACC,
  referral: null,
  storageCosts: costs,
  wrapNearMinDeposit: WRAP_MIN,
  input: ONE_NEAR,
  wrapNearBalance: new FixedNumber(0n, 24),
  memeSymbol: "TEST",
};

// The reported bug: `storage_balance_of` answers null for an account that never
// registered, which is exactly the account a storage deposit is supposed to
// onboard. Treating it as "still loading" left the button dead.
test("unregistered account gets a registration step and a storage deposit", () => {
  const plan = buildDepositPlan({
    ...base,
    storageBalance: null,
    wrapNearRegistered: false,
    referrerBalance: { known: false },
  });

  assert.deepEqual(plan.needStorageDeposit, {
    depositAmount: "125000000000000000000000",
  });
  assert.deepEqual(plan.wrapNearDeposit, { depositAmount: WRAP_MIN });
  assert.deepEqual(plan.steps, [
    "Register account with storage deposit of 0.125 NEAR",
    "Register wNEAR token (0.00125 NEAR)",
    "Wrap 1 NEAR to wNEAR",
    "Deposit 1 NEAR to $TEST",
  ]);
});

// `storage_balance_of` also answers null for a referrer who never registered.
// That used to block the deposit outright; it should only drop the referral.
test("unregistered referrer is ignored, not fatal", () => {
  const plan = buildDepositPlan({
    ...base,
    referral: REF,
    storageBalance: plenty,
    wrapNearRegistered: true,
    referrerBalance: { known: true, balance: null },
  });

  assert.equal(plan.referrer, undefined);
  assert.equal(plan.referralRejected, true);
  assert.deepEqual(plan.steps, [
    "⚠️ Referral not registered - referral will be ignored",
    "Wrap 1 NEAR to wNEAR",
    "Deposit 1 NEAR to $TEST",
  ]);
});

test("self referral is ignored, not fatal", () => {
  const plan = buildDepositPlan({
    ...base,
    referral: ACC,
    storageBalance: plenty,
    wrapNearRegistered: true,
    referrerBalance: { known: true, balance: plenty },
  });

  assert.equal(plan.referrer, undefined);
  assert.equal(plan.referralRejected, true);
  assert.equal(plan.steps[0]?.startsWith("⚠️ Referral cannot be"), true);
});

test("registered referrer is kept", () => {
  const plan = buildDepositPlan({
    ...base,
    referral: REF,
    storageBalance: plenty,
    wrapNearRegistered: true,
    referrerBalance: { known: true, balance: plenty },
  });

  assert.equal(plan.referrer, REF);
  assert.equal(plan.referralRejected, false);
});

test("unknown referrer balance drops the referral but does not block", () => {
  const plan = buildDepositPlan({
    ...base,
    referral: REF,
    storageBalance: plenty,
    wrapNearRegistered: true,
    referrerBalance: { known: false },
  });

  assert.equal(plan.referrer, undefined);
  assert.equal(plan.referralRejected, false);
  assert.deepEqual(plan.steps, [
    "Wrap 1 NEAR to wNEAR",
    "Deposit 1 NEAR to $TEST",
  ]);
});

test("registered account with wrapped balance needs no registration or wrap", () => {
  const plan = buildDepositPlan({
    ...base,
    storageBalance: plenty,
    wrapNearRegistered: true,
    referrerBalance: { known: false },
    wrapNearBalance: new FixedNumber(2n * 10n ** 24n, 24),
  });

  assert.equal(plan.needStorageDeposit, null);
  assert.equal(plan.wrapNearDeposit, null);
  assert.equal(plan.extraNearDeposit, 0n);
  assert.deepEqual(plan.steps, ["Deposit 1 NEAR to $TEST"]);
});

test("low remaining storage tops up five deposits", () => {
  const plan = buildDepositPlan({
    ...base,
    storageCosts: {
      account: "1000000000000000000000",
      perMemeDeposit: PER_MEME,
    },
    storageBalance: {
      total: plenty.total,
      available: "2000000000000000000000",
    },
    wrapNearRegistered: true,
    referrerBalance: { known: false },
    wrapNearBalance: new FixedNumber(2n * 10n ** 24n, 24),
  });

  assert.deepEqual(plan.needStorageDeposit, {
    depositAmount: "25000000000000000000000",
  });
  assert.deepEqual(plan.steps, [
    "Add storage deposit of 0.025 NEAR",
    "Deposit 1 NEAR to $TEST",
  ]);
});
