import assert from "node:assert/strict";
import test from "node:test";

import {
  convertGate,
  type ConvertGateInput,
} from "../src/bridge/convertGate.ts";
import type { RoutePlan, RouteSearch } from "../src/bridge/search.ts";

function plan(receiveAmount: bigint, targetDecimals = 9): RoutePlan {
  return {
    rail: {
      tokenId: "SHITZU",
      symbol: "SHITZU",
      icon: "/s.webp",
      sourceAddress: "token.0xshitzu.near",
      destAddress: "AFbJW5",
      sourceDecimals: 18,
      destDecimals: 9,
    },
    sourceSymbol: "USDT",
    targetSymbol: "SHITZU",
    targetDecimals,
    sourceSwap: null,
    targetSwap: null,
    bridgedAmount: 1_000n,
    tokenFee: 0n,
    nativeFee: 0n,
    usdFee: null,
    arrivedAmount: 1_000n,
    receiveAmount,
    receiveEstimated: receiveAmount,
  };
}

const search = (plans: RoutePlan[]): RouteSearch => ({ plans, rejected: [] });

const ready: ConvertGateInput = {
  amount: 1_000_000n,
  search: search([plan(2_000_000_000n)]),
  searching: false,
  searchFailed: false,
  sourceConnected: true,
  destConnected: true,
  isSubmitting: false,
  awaitingFinal: false,
  awaitingDeposit: false,
  done: false,
  available: 10_000_000n,
  nativeBalance: 500_000_000n,
  nativeReserve: 120_000n,
  supported: true,
};

test("a priced route with both wallets connected submits", () => {
  const gate = convertGate(ready);
  assert.equal(gate.canSubmit, true);
  assert.equal(gate.label, "Convert");
});

test("an unsupported network blocks outright and says why", () => {
  const gate = convertGate({ ...ready, supported: false });
  assert.equal(gate.canSubmit, false);
  assert.equal(gate.label, "Mainnet only");
});

test("an in-flight transfer outranks a done state for the label", () => {
  // Otherwise the button flips to "Done" the moment the deposit lands, while the
  // destination swap is still running.
  const gate = convertGate({ ...ready, isSubmitting: true, done: true });
  assert.equal(gate.canSubmit, false);
  assert.equal(gate.label, "Converting…");
});

test("the source wallet is asked for before the destination one", () => {
  const neither = convertGate({
    ...ready,
    sourceConnected: false,
    destConnected: false,
  });
  assert.equal(neither.needsSourceConnect, true);
  assert.equal(neither.needsDestConnect, false);
  assert.equal(neither.label, "Connect source wallet");

  const onlyDest = convertGate({ ...ready, destConnected: false });
  assert.equal(onlyDest.needsDestConnect, true);
  assert.equal(onlyDest.label, "Connect destination wallet");
});

test("no amount means no search and no submit", () => {
  const gate = convertGate({ ...ready, amount: null, search: null });
  assert.equal(gate.canSubmit, false);
  assert.equal(gate.label, "Enter an amount");
});

test("a zero amount is treated as no amount", () => {
  const gate = convertGate({ ...ready, amount: 0n });
  assert.equal(gate.canSubmit, false);
  assert.equal(gate.label, "Enter an amount");
});

test("a search in flight is not reported as no route", () => {
  // This is the distinction that matters most in the whole gate: an empty result
  // while searching is the normal state of a form mid-typing, and telling the
  // user "no route available" then would be a lie they can see through.
  const gate = convertGate({
    ...ready,
    searching: true,
    search: search([]),
  });
  assert.equal(gate.canSubmit, false);
  assert.equal(gate.noRoute, false);
  assert.equal(gate.label, "Finding a route…");
});

test("a finished search with nothing usable says no route", () => {
  const gate = convertGate({ ...ready, search: search([]) });
  assert.equal(gate.canSubmit, false);
  assert.equal(gate.noRoute, true);
  assert.equal(gate.label, "No route available");
});

test("a failed search is not the same as finding nothing", () => {
  // Both leave the list empty, but one is our problem and the other is the
  // market's, and the user can act on only one of them.
  const gate = convertGate({
    ...ready,
    searchFailed: true,
    search: search([]),
  });
  assert.equal(gate.canSubmit, false);
  assert.equal(gate.noRoute, false);
  assert.equal(gate.label, "Couldn't price this — try again");
});

test("a sub-unit route is too small, not no route", () => {
  const gate = convertGate({ ...ready, search: search([plan(5n)]) });
  assert.equal(gate.canSubmit, false);
  assert.equal(gate.noRoute, false);
  assert.equal(gate.tooSmall, true);
  assert.equal(gate.label, "Amount too small");
});

test("the sub-unit check uses the target's decimals, not a default", () => {
  // 100_000 units of a 5-decimal token is an ordinary amount. Judged against 9
  // decimals it would look like dust and block a perfectly good route.
  const fine = convertGate({
    ...ready,
    search: search([plan(100_000n, 5)]),
  });
  assert.equal(fine.canSubmit, true);
});

test("one usable route among several is enough", () => {
  const gate = convertGate({
    ...ready,
    search: search([plan(1n), plan(2_000_000_000n)]),
  });
  assert.equal(gate.canSubmit, true);
  assert.equal(gate.tooSmall, false);
});

test("an amount beyond the balance is refused", () => {
  const gate = convertGate({ ...ready, amount: 100_000_000n });
  assert.equal(gate.canSubmit, false);
  assert.equal(gate.insufficientBalance, true);
  assert.equal(gate.label, "Insufficient balance");
});

test("an unknown balance does not block the form", () => {
  // A slow RPC must not leave the button greyed out with no explanation.
  const gate = convertGate({ ...ready, available: null });
  assert.equal(gate.canSubmit, true);
  assert.equal(gate.insufficientBalance, false);
});

test("gas is checked against the native token, not the source token", () => {
  // Bridging costs native currency whatever is being moved, so a user with a
  // large token balance and no SOL still cannot send.
  const gate = convertGate({ ...ready, nativeBalance: 1_000n });
  assert.equal(gate.canSubmit, false);
  assert.equal(gate.insufficientGas, true);
  assert.equal(gate.label, "Not enough for fees");
});

test("an unknown native balance does not block the form", () => {
  const gate = convertGate({ ...ready, nativeBalance: null });
  assert.equal(gate.canSubmit, true);
  assert.equal(gate.insufficientGas, false);
});

test("a null search before anything has run blocks without claiming no route", () => {
  const gate = convertGate({ ...ready, search: null });
  assert.equal(gate.canSubmit, false);
  assert.equal(gate.noRoute, false);
});

test("a plan with no receive amount is not usable", () => {
  const gate = convertGate({ ...ready, search: search([plan(0n)]) });
  assert.equal(gate.canSubmit, false);
  assert.equal(gate.noRoute, true);
});

// A NEAR conversion takes two presses, because the second one's wallet popup has
// to answer a user gesture. The browser only permits a popup in direct response to
// one, and the gesture that started the transfer is minutes old by the time the
// bridge has finalised — signing from there fails with "Popup was blocked" on a
// bridge that worked perfectly.

test("a pending bridge deposit says so, not the destination swap", () => {
  // A split NEAR route stops after the swap. The press that finishes it signs the
  // *deposit*, and calling that "Swap into the target token" would name a step the
  // user has not reached — and it is the difference between which signature they are
  // about to give.
  const gate = convertGate({ ...ready, awaitingDeposit: true });
  assert.equal(gate.canSubmit, true);
  assert.equal(gate.label, "Bridge to the destination chain");
});

test("a landed first leg leaves the button pressable and says what it does", () => {
  const gate = convertGate({ ...ready, awaitingFinal: true });
  // Pressable, or the only button that can finish the conversion is disabled.
  assert.equal(gate.canSubmit, true);
  // And it names the action, rather than "Convert" implying the whole thing is
  // still ahead or "Done" claiming it is finished.
  assert.equal(gate.label, "Swap into the target token");
});

test("a pending final leg is pressable even while a submission is in flight", () => {
  // The two flags coexist for the moment between the bridge landing and the press.
  // Guarding on `isSubmitting` alone would disable the button at exactly the point
  // it is the only way forward.
  const gate = convertGate({
    ...ready,
    awaitingFinal: true,
    isSubmitting: true,
  });
  assert.equal(gate.canSubmit, true);
});

test("a pending final leg does not survive the form being done", () => {
  const gate = convertGate({ ...ready, awaitingFinal: true, done: true });
  assert.equal(gate.canSubmit, false);
  assert.equal(gate.label, "Done");
});

test("nothing else about the form re-enables itself while a leg is pending", () => {
  // `awaitingFinal` is about the button, not a shortcut past the route checks.
  for (const broken of [
    { supported: false },
    { sourceConnected: false },
    { destConnected: false },
    { searching: true },
    { searchFailed: true },
    { noRoute: true, search: search([]) },
  ] as Partial<ConvertGateInput>[]) {
    const gate = convertGate({ ...ready, awaitingDeposit: true, ...broken });
    assert.equal(
      gate.canSubmit,
      false,
      `re-enabled by ${JSON.stringify(broken)}`,
    );
  }
});
