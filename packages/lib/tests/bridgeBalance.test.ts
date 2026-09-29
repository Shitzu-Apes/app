import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { bridgeGate, type BridgeGateInput } from "../src/bridge/amount.ts";

const SHEET =
  "src/components/memecooking/BottomSheet/SolToNearBridgeSheet.svelte";
const sheet = readFileSync(SHEET, "utf8");

const ready: BridgeGateInput = {
  amount: 1_000_000_000n,
  bridgedWnear: 25_000_000_000n,
  needsSwap: true,
  quoteAvailable: true,
  nearConnected: true,
  solanaConnected: true,
  isBridging: false,
  supported: true,
  tokenFee: 2_064_491n,
  available: 10_000_000_000n,
  solBalance: 500_000_000n,
  solReserve: 120_000n,
};

test("an amount within the balance is allowed", () => {
  const gate = bridgeGate(ready);
  assert.equal(gate.insufficientBalance, false);
  assert.equal(gate.canSubmit, true);
});

test("spending more than the wallet holds is blocked", () => {
  // The bug: the balance was displayed but never enforced, so the form happily
  // offered to swap or bridge an amount the wallet could not cover.
  const gate = bridgeGate({
    ...ready,
    amount: 20_000_000_000n,
    available: 10_000_000_000n,
  });
  assert.equal(gate.insufficientBalance, true);
  assert.equal(gate.canSubmit, false);
  assert.equal(gate.label, "Insufficient balance");
});

test("spending exactly the whole balance is allowed", () => {
  const gate = bridgeGate({ ...ready, amount: 10_000_000_000n });
  assert.equal(gate.insufficientBalance, false);
  assert.equal(gate.canSubmit, true);
});

test("one base unit over is rejected", () => {
  const gate = bridgeGate({ ...ready, amount: 10_000_000_001n });
  assert.equal(gate.insufficientBalance, true);
  assert.equal(gate.canSubmit, false);
});

test("an unknown balance must not block the form", () => {
  // Balances load asynchronously; a null balance is not a reason to disable.
  const gate = bridgeGate({ ...ready, available: null });
  assert.equal(gate.insufficientBalance, false);
  assert.equal(gate.canSubmit, true);
});

test("the SOL network fee is checked independently of the source token", () => {
  // Bridging USDC still costs SOL for the deposit transaction.
  const gate = bridgeGate({
    ...ready,
    needsSwap: true,
    solBalance: 10_000n,
    solReserve: 120_000n,
  });
  assert.equal(gate.insufficientSol, true);
  assert.equal(gate.canSubmit, false);
  assert.equal(gate.label, "Not enough SOL for fees");
});

test("an unknown SOL balance does not block the form", () => {
  const gate = bridgeGate({ ...ready, solBalance: null });
  assert.equal(gate.insufficientSol, false);
  assert.equal(gate.canSubmit, true);
});

test("an insufficient balance outranks the fee floor", () => {
  const gate = bridgeGate({
    ...ready,
    bridgedWnear: 1_000n,
    tokenFee: 2_064_491n,
    amount: 99_000_000_000n,
    available: 1_000_000_000n,
  });
  assert.equal(gate.tooSmall, true);
  assert.equal(gate.insufficientBalance, true);
  // The most actionable problem is named first.
  assert.equal(gate.label, "Insufficient balance");
});

test("Max is capped at the spendable amount, not the raw balance", () => {
  assert.match(sheet, /formatBaseUnits\(available \?\? 0n, source\.decimals\)/);
  // Paying in SOL must reserve the network fee out of the same balance.
  assert.match(sheet, /currentBalance - solReserve/);
  assert.match(sheet, /: 0n\s*$/m);
});

test("the sheet surfaces both balance problems", () => {
  assert.match(sheet, /\{#if gate\.insufficientBalance/);
  assert.match(sheet, /\{#if gate\.insufficientSol\}/);
  assert.match(sheet, /Not enough SOL to pay the network fee\./);
});

test("the verbose card helper texts are gone", () => {
  for (const text of [
    "Funds are taken from this Solana wallet.",
    "You receive NEAR on this account.",
    "You need a Solana wallet to pay from.",
    "You need a Near wallet to receive the tokens.",
  ]) {
    assert.equal(sheet.includes(text), false, `should have removed: "${text}"`);
  }
});
