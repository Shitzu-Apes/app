import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const BUTTON = "src/components/memecooking/Board/MCDepositButton.svelte";
const PLAN = "src/components/memecooking/Board/depositPlan.ts";

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");

const button = read(BUTTON);
const plan = read(PLAN);

// The reported bug: the deposit button treated `storage_balance_of === null`
// (a wallet that never registered on the contract) and `isUserRegistered ===
// false` (a wallet that never registered on wrap.near) as "still loading" and
// returned before signing anything. Those are the exact states the deposit
// transaction onboards, so every first-time wallet was blocked while wallets
// that had deposited before worked. There is no component test runner here, so
// this pins the wiring in the source.
test("the deposit handler does not gate on truthy query data", () => {
  assert.doesNotMatch(button, /!\$storageBalanceQuery\.data/);
  assert.doesNotMatch(button, /!\$storageCostsQuery\.data/);
  assert.doesNotMatch(button, /!\$wrapNearRegistrationQuery\.data/);
  assert.doesNotMatch(button, /!\$wrapNearStorageQuery\.data/);
  assert.doesNotMatch(button, /Queries still loading or failed/);
});

test("readiness comes from the query status", () => {
  assert.match(
    button,
    /coreQueriesReady\s*=\s*\n\s*\$storageBalanceQuery\.status === "success"/,
  );

  const statusChecks = button.match(/\.status === "success"/g) ?? [];
  assert.ok(
    statusChecks.length >= 4,
    `expected every deposit query to be status-gated, found ${statusChecks.length}`,
  );
});

test("a real query failure is surfaced instead of silently swallowing the click", () => {
  assert.match(button, /coreQueriesFailed/);
  assert.match(button, /Could not load deposit details/);
  assert.match(button, /\.refetch\(\)/);
});

test("the deposit transaction still receives both storage deposits", () => {
  assert.match(
    button,
    /const \{ referrer, needStorageDeposit, wrapNearDeposit, extraNearDeposit \} =\s*\n\s*depositPlan/,
  );
  assert.match(button, /needStorageDeposit,\s*\n\s*wrapNearDeposit,/);
  assert.match(button, /MemeCooking\.deposit\(/);
});

test("steps are derived from the plan, not re-derived inline", () => {
  assert.match(button, /depositPlan\?\.steps/);
  assert.doesNotMatch(button, /Register account with storage deposit/);
  assert.match(plan, /Register account with storage deposit/);
});
