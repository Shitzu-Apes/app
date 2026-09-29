import assert from "node:assert/strict";
import test from "node:test";

import type { RoutePlan } from "../src/bridge/search.ts";
import {
  activeStep,
  costSummary,
  isComplete,
  percentBehind,
  planSteps,
  withProgress,
} from "../src/bridge/steps.ts";

function plan(overrides: Partial<RoutePlan> = {}): RoutePlan {
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
    sourceSymbol: "USDC",
    targetSymbol: "SHITZU",
    targetDecimals: 9,
    sourceSwap: {
      guaranteedOut: 2_000_000_000_000_000_000n,
      estimatedOut: 2_100_000_000_000_000_000n,
      dexes: ["Rhea"],
      outputToken: "token.0xshitzu.near",
    },
    targetSwap: null,
    bridgedAmount: 2_000_000_000_000_000_000n,
    tokenFee: 20_000_000_000_000n,
    nativeFee: 82_439n,
    usdFee: 0.01,
    arrivedAmount: 1_999_999n,
    receiveAmount: 1_999_999n,
    receiveEstimated: 1_999_999n,
    ...overrides,
  };
}

test("a two-leg route is two steps, in order", () => {
  // No trailing "receive": it repeated the bridge step's symbol and its exact
  // amount, so the plan read as two entries for one fact, and the second claimed
  // nothing was left to do while the bridge was still in flight.
  const steps = planSteps(plan(), "near", "solana");
  assert.deepEqual(
    steps.map((s) => s.id),
    ["swap-in", "bridge"],
  );
});

test("a three-leg route adds the destination swap", () => {
  const steps = planSteps(
    plan({
      targetSwap: {
        guaranteedOut: 3_000n,
        estimatedOut: 3_100n,
        dexes: ["Meteora DLMM"],
        outputToken: "AFbJW5",
      },
    }),
    "near",
    "solana",
  );
  assert.deepEqual(
    steps.map((s) => s.id),
    ["swap-in", "bridge", "swap-out"],
  );
});

test("a plain bridge is one step, with no empty ones around it", () => {
  // A "Swap" step with nothing to do would read as a broken control rather than
  // as a route that does not need one, and a "receive" step after a bridge that
  // already states the arriving amount is the same mistake.
  const steps = planSteps(
    plan({ sourceSwap: null, targetSwap: null, bridgedAmount: 1_000n }),
    "near",
    "solana",
  );
  assert.deepEqual(
    steps.map((s) => s.id),
    ["bridge"],
  );
});

test("the bridge step names the asset and both chains", () => {
  // The whole point of the list: what crosses the middle is neither what the
  // user typed in nor what they get out.
  const bridge = planSteps(plan(), "near", "solana").find(
    (s) => s.id === "bridge",
  );
  assert.ok(bridge);
  assert.match(bridge!.title, /SHITZU/);
  assert.match(bridge!.title, /Near/);
  assert.match(bridge!.title, /Solana/);
  assert.equal(bridge!.chain, "near");
});

test("each swap is attributed to the chain it happens on", () => {
  const steps = planSteps(
    plan({
      targetSwap: {
        guaranteedOut: 3_000n,
        estimatedOut: 3_100n,
        dexes: ["Rhea"],
        outputToken: "AFbJW5",
      },
    }),
    "near",
    "solana",
  );
  assert.equal(steps.find((s) => s.id === "swap-in")!.chain, "near");
  // The destination swap needs a Solana signature, not a NEAR one, and the user
  // cannot tell that from a single "via" line.
  assert.equal(steps.find((s) => s.id === "swap-out")!.chain, "solana");
});

test("the venues behind each swap are named", () => {
  const steps = planSteps(
    plan({
      targetSwap: {
        guaranteedOut: 3_000n,
        estimatedOut: 3_100n,
        dexes: ["Rhea", "Rhea", "Plach"],
        outputToken: "AFbJW5",
      },
    }),
    "near",
    "solana",
  );
  assert.deepEqual(steps[0].venues, ["Rhea"]);
  // De-duplicated: a route through three pools on one DEX is one venue to a user.
  assert.deepEqual(steps[2].venues, ["Rhea", "Plach"]);
  // The bridge is not a DEX and inventing a venue for it would be a lie.
  assert.deepEqual(steps[1].venues, []);
});

test("every step starts pending", () => {
  for (const step of planSteps(plan(), "near", "solana")) {
    assert.equal(step.state, "pending");
  }
});

test("progress marks the step in flight and everything before it done", () => {
  const steps = withProgress(planSteps(plan(), "near", "solana"), 1);
  assert.deepEqual(
    steps.map((s) => s.state),
    ["done", "active"],
  );
  assert.equal(activeStep(steps)?.id, "bridge");
});

test("a failed step is marked failed, not left active", () => {
  // "Active" on a step that already failed would leave the button spinning
  // forever with no indication of what went wrong.
  const steps = withProgress(planSteps(plan(), "near", "solana"), 1, true);
  assert.equal(steps[1].state, "failed");
});

test("completion needs every step, not just the first", () => {
  const steps = planSteps(plan(), "near", "solana");
  assert.equal(isComplete(withProgress(steps, 0)), false);
  assert.equal(isComplete(withProgress(steps, steps.length)), true);
  assert.equal(isComplete([]), false);
});

test("a worse route says how far behind it is", () => {
  const best = plan({ receiveAmount: 1_000_000n });
  assert.equal(percentBehind(best, best), 0);
  // Ten percent fewer tokens is the number a user needs to choose with.
  assert.equal(percentBehind(plan({ receiveAmount: 900_000n }), best), 10);
  // Rounded to one decimal rather than truncated to a misleading whole number.
  assert.equal(percentBehind(plan({ receiveAmount: 955_000n }), best), 4.5);
});

test("an unpriceable or identical route has no percentage", () => {
  const best = plan({ receiveAmount: 0n });
  assert.equal(percentBehind(plan({ receiveAmount: null }), best), null);
  assert.equal(percentBehind(plan({ receiveAmount: 1n }), best), null);
});

test("the cost shows both the token fee and the native fee", () => {
  // The native fee is paid out of the wallet's SOL or NEAR and reduces nothing
  // about the amount, so omitting it made the transfer look free.
  const cost = costSummary(plan(), "solana");
  assert.match(cost, /SHITZU/, "the token fee names the rail");
  assert.match(cost, /SOL/, "the native fee names the chain's own token");
  // 2e13 at 18 decimals is 0.00002, and 82439 lamports is 0.000082 SOL. Both
  // halves are shown, in the token each is actually charged in.
  assert.match(cost, /0\.00002 SHITZU/);
  assert.match(cost, /0\.000082 SOL/);
});

test("the native fee is denominated in the source chain's token", () => {
  assert.match(costSummary(plan(), "near"), /NEAR/);
  assert.match(costSummary(plan(), "solana"), /SOL/);
});

test("a route with no fee says so rather than showing a zero", () => {
  const cost = costSummary(
    plan({ tokenFee: 0n, nativeFee: 0n, usdFee: null }),
    "solana",
  );
  assert.equal(cost, "");
});

// The fee belongs on the step that charges it.

test("the bridge step states the gas the bridge is about to spend", () => {
  // The bridge takes two different things — a slice of the bridged token, and
  // the source chain's own gas — and the second was missing from the step. A
  // Solana → NEAR transfer spends ~0.000081 SOL whatever the amount, and that
  // value left the account while the step said nothing about it.
  const bridge = planSteps(
    plan({ tokenFee: 0n, nativeFee: 81_431n, usdFee: 0.01 }),
    "solana",
    "near",
  ).find((s) => s.id === "bridge");
  assert.ok(bridge);
  // Shown on the step, not only in the summary card, so it is present wherever
  // the route is being read.
  assert.match(bridge.detail, /SOL/);
  assert.match(bridge.detail, /Omni Bridge/);
});

test("a step with no fee does not claim one", () => {
  const bridge = planSteps(
    plan({ tokenFee: 0n, nativeFee: 0n, usdFee: null }),
    "solana",
    "near",
  ).find((s) => s.id === "bridge");
  assert.equal(bridge?.detail, "Omni Bridge");
});

// A leg that is waiting on the user is not a leg that is running.

test("a step waiting on the user reads as pending, not active", () => {
  // The reported symptom: the bridge had finalised and the step still showed a
  // spinner. A cross-chain conversion stops between the bridge and the destination
  // swap, because that signature has to answer a fresh click — the first one is
  // minutes old by then and its popups would be blocked. Nothing is in flight at
  // that moment, so rendering the step as active is the app contradicting the
  // chain about whether the money arrived.
  // The shape this is about: a swap in, a bridge, and a destination swap that
  // cannot start until the bridge has landed and the user has pressed again.
  const steps = planSteps(
    plan({
      sourceSwap: {
        guaranteedOut: 181_661n,
        estimatedOut: 181_661n,
        dexes: ["Denali"],
        outputToken: "a",
      },
      targetSwap: {
        guaranteedOut: 116_373n,
        estimatedOut: 116_373n,
        dexes: ["Plach"],
        outputToken: "b",
      },
    }),
    "solana",
    "near",
  );
  assert.deepEqual(
    steps.map((s) => s.id),
    ["swap-in", "bridge", "swap-out"],
  );
  const swapOut = steps.findIndex((s) => s.id === "swap-out");
  assert.ok(swapOut > 0, "there is a destination swap to wait on");

  // Parked on the swap: the bridge is done, the swap is pending.
  const parked = withProgress(steps, swapOut, false, true);
  assert.deepEqual(
    parked.map((s) => s.state),
    ["done", "done", "pending"],
  );

  // Running: same index, but the step is in flight.
  const running = withProgress(steps, swapOut, false, false);
  assert.equal(running[swapOut].state, "active");

  // And a failure still wins over both.
  const failed = withProgress(steps, swapOut, true, true);
  assert.equal(failed[swapOut].state, "failed");
});

test("a failed step is not softened by being parked", () => {
  // "Waiting on the user" and "failed" are different, and conflating them would
  // leave a broken swap looking like something the user just needs to press.
  const steps = planSteps(
    plan({
      sourceSwap: {
        guaranteedOut: 181_661n,
        estimatedOut: 181_661n,
        dexes: ["Denali"],
        outputToken: "a",
      },
      targetSwap: {
        guaranteedOut: 116_373n,
        estimatedOut: 116_373n,
        dexes: ["Plach"],
        outputToken: "b",
      },
    }),
    "solana",
    "near",
  );
  const states = withProgress(steps, 1, true, true).map((s) => s.state);
  assert.equal(states[1], "failed");
});

test("a same-chain conversion is one step, with no trailing receive", () => {
  // It used to push a second step saying "Receive X on Near", carrying the same symbol
  // and the same amount as the swap directly above it. The cross-chain branch drops its
  // receive step for precisely that reason and this one did not, so the *simplest* route
  // in the form was the only one that read as though something were still to happen.
  const sameChain = plan({ rail: null, sourceSwap: { dexes: ["Rhea"] } });
  const steps = planSteps(sameChain, "near", "near");
  assert.equal(steps.length, 1, "a swap is the whole route");
  assert.equal(steps[0]?.kind, "swap");
  assert.equal(
    steps[0]?.amount,
    sameChain.receiveAmount,
    "and it carries the amount",
  );
  // Nothing anywhere in the list repeats the swap's own outcome.
  assert.equal(steps.filter((s) => s.kind === "receive").length, 0);
  assert.equal(
    steps.filter((s) => s.symbol === sameChain.targetSymbol).length,
    1,
    "the target is named once",
  );
});
