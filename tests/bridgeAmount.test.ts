import assert from "node:assert/strict";
import test from "node:test";

import {
  bridgeGate,
  formatBaseUnits,
  parseBaseUnits,
  type BridgeGateInput,
} from "../src/lib/bridge/amount.ts";

test("parses plain decimals into base units", () => {
  assert.equal(parseBaseUnits("1", 9), 1_000_000_000n);
  assert.equal(parseBaseUnits("1.5", 9), 1_500_000_000n);
  assert.equal(parseBaseUnits("0.000000001", 9), 1n);
  assert.equal(parseBaseUnits(".5", 9), 500_000_000n);
  assert.equal(parseBaseUnits(" 2 ", 9), 2_000_000_000n);
  assert.equal(parseBaseUnits("0", 9), 0n);
});

test("respects each token's decimals", () => {
  // USDC is 6 decimals, SOL and wNEAR are 9.
  assert.equal(parseBaseUnits("1.5", 6), 1_500_000n);
  assert.equal(parseBaseUnits("1.5", 9), 1_500_000_000n);
});

test("rejects input that is not a non-negative decimal", () => {
  for (const bad of [
    undefined,
    "",
    "   ",
    "abc",
    "-1",
    "1.2.3",
    "1e9",
    "0x10",
    "1,5",
    "+1",
  ]) {
    assert.equal(parseBaseUnits(bad, 9), null, `expected null for ${bad}`);
  }
});

test("rejects more precision than the token supports", () => {
  // 10 decimals would be dust for a 9-decimal token; refuse rather than round.
  assert.equal(parseBaseUnits("1.1234567891", 9), null);
  assert.equal(parseBaseUnits("1.123456789", 9), 1_123_456_789n);
  assert.equal(parseBaseUnits("1.1234567", 6), null);
});

test("formats base units back to a trimmed decimal", () => {
  assert.equal(formatBaseUnits(1_000_000_000n, 9), "1");
  assert.equal(formatBaseUnits(1_500_000_000n, 9), "1.5");
  assert.equal(formatBaseUnits(0n, 9), "0");
  assert.equal(formatBaseUnits(null, 9), "0");
});

// --- the gate -------------------------------------------------------------

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
};

test("a fully connected, quoted form can submit", () => {
  const gate = bridgeGate(ready);
  assert.equal(gate.canSubmit, true);
  assert.equal(gate.label, "Buy NEAR & bridge");
  assert.equal(gate.tooSmall, false);
});

test("a wNEAR source skips the swap wording", () => {
  const gate = bridgeGate({
    ...ready,
    needsSwap: false,
    bridgedWnear: 25_000_000_000n,
  });
  assert.equal(gate.label, "Bridge to Near");
  assert.equal(gate.canSubmit, true);
});

test("Solana is prompted first, matching the leading From card", () => {
  const gate = bridgeGate({
    ...ready,
    nearConnected: false,
    solanaConnected: false,
  });
  assert.equal(gate.needsSolanaConnect, true);
  assert.equal(gate.needsNearConnect, false, "NEAR is not asked for yet");
  assert.equal(gate.label, "Connect Solana wallet");
  assert.equal(gate.canSubmit, false);
});

test("NEAR is prompted once Solana is connected", () => {
  const gate = bridgeGate({ ...ready, nearConnected: false });
  assert.equal(gate.needsSolanaConnect, false);
  assert.equal(gate.needsNearConnect, true);
  assert.equal(gate.label, "Connect NEAR wallet");
  assert.equal(gate.canSubmit, false);
});

test("an empty amount asks for input, not a wallet", () => {
  for (const amount of [null, 0n]) {
    const gate = bridgeGate({ ...ready, amount, bridgedWnear: null });
    assert.equal(gate.label, "Enter an amount");
    assert.equal(gate.canSubmit, false);
    assert.equal(gate.needsNearConnect, false);
  }
});

test("an in-flight quote reports progress and blocks submit", () => {
  const gate = bridgeGate({ ...ready, quoteAvailable: null });
  assert.equal(gate.label, "Fetching quote…");
  assert.equal(gate.canSubmit, false);
});

test("a missing route is reported as such", () => {
  const gate = bridgeGate({ ...ready, quoteAvailable: false });
  assert.equal(gate.label, "No route available");
  assert.equal(gate.canSubmit, false);
});

test("a wNEAR source ignores quote state entirely", () => {
  for (const quoteAvailable of [null, false, true]) {
    const gate = bridgeGate({
      ...ready,
      needsSwap: false,
      quoteAvailable,
      bridgedWnear: 25_000_000_000n,
    });
    assert.equal(gate.canSubmit, true, `quoteAvailable=${quoteAvailable}`);
  }
});

test("amounts at or below the quoted bridge fee are rejected", () => {
  // The floor is now the real fee rather than a hardcoded guess, so it tracks
  // whatever the bridge charges.
  const fee = 2_064_491n;

  const atFloor = bridgeGate({
    ...ready,
    needsSwap: false,
    tokenFee: fee,
    bridgedWnear: fee,
  });
  assert.equal(atFloor.tooSmall, true);
  assert.equal(atFloor.label, "Amount too small");
  assert.equal(atFloor.canSubmit, false);
  assert.equal(atFloor.netAmount, null);

  const belowFloor = bridgeGate({
    ...ready,
    needsSwap: false,
    tokenFee: fee,
    bridgedWnear: fee - 1n,
  });
  assert.equal(belowFloor.tooSmall, true);
  assert.equal(belowFloor.canSubmit, false);

  const aboveFloor = bridgeGate({
    ...ready,
    needsSwap: false,
    tokenFee: fee,
    bridgedWnear: fee + 1n,
  });
  assert.equal(aboveFloor.tooSmall, false);
  assert.equal(aboveFloor.canSubmit, true);
  assert.equal(aboveFloor.netAmount, 1n);
});

test("the net amount is the deposit minus the fee", () => {
  const gate = bridgeGate({
    ...ready,
    needsSwap: false,
    tokenFee: 2_064_491n,
    bridgedWnear: 203_889_181n,
  });
  // The user's real transfer: 0.203889181 bridged, 0.002064491 fee.
  assert.equal(gate.netAmount, 201_824_690n);
});

test("an unquoted fee must not block the form", () => {
  // The fee request may still be in flight; that is not a reason to disable.
  const gate = bridgeGate({ ...ready, tokenFee: null });
  assert.equal(gate.canSubmit, true);
  assert.equal(gate.netAmount, null);
  assert.equal(gate.tooSmall, false);
});

test("a completed transfer stops the form offering another", () => {
  const gate = bridgeGate({ ...ready, done: true });
  assert.equal(gate.canSubmit, false);
  assert.equal(gate.label, "Done");
});

test("done outranks an in-flight label", () => {
  const gate = bridgeGate({ ...ready, done: true, isBridging: true });
  assert.equal(gate.label, "Done");
});

test("the swap floor is judged on wNEAR output, not the input amount", () => {
  // 0.0001 SOL is a non-trivial SOL amount, but it only yields 0.002 wNEAR,
  // which is under the 0.0025 wNEAR floor and cannot cover the bridge fee.
  const dust = bridgeGate({
    ...ready,
    amount: 100_000n,
    bridgedWnear: 2_000_000n,
  });
  assert.equal(dust.tooSmall, true, "0.002 wNEAR cannot cover the fee");

  // 1 SOL yields ~24.7 wNEAR, comfortably over the floor.
  const fine = bridgeGate({
    ...ready,
    amount: 1_000_000_000n,
    bridgedWnear: 24_717_000_000n,
  });
  assert.equal(fine.tooSmall, false);
  assert.equal(fine.canSubmit, true);
});

test("an in-flight bridge always wins the label", () => {
  const gate = bridgeGate({
    ...ready,
    isBridging: true,
    nearConnected: false,
  });
  assert.equal(gate.label, "Bridging…");
  assert.equal(gate.canSubmit, false);
});

test("an unsupported network blocks submit and says why", () => {
  // Testnet: Jupiter quotes mainnet pools but the bridge contract has no wNEAR
  // token registered, so a deposit can never settle.
  const gate = bridgeGate({ ...ready, supported: false });
  assert.equal(gate.canSubmit, false);
  assert.equal(gate.label, "Mainnet only");
});

test("an unsupported network reports the network before the wallets", () => {
  const gate = bridgeGate({
    ...ready,
    supported: false,
    nearConnected: false,
    solanaConnected: false,
  });
  assert.equal(gate.label, "Mainnet only");
  // No point prompting to connect a wallet that still cannot bridge.
  assert.equal(gate.needsSolanaConnect, true);
  assert.equal(gate.canSubmit, false);
});

test("an in-flight bridge still wins over unsupported", () => {
  const gate = bridgeGate({ ...ready, supported: false, isBridging: true });
  assert.equal(gate.label, "Bridging…");
});
