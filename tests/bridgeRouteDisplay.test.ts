import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { RoutePlan } from "../src/lib/bridge/search.ts";
import { percentBehind } from "../src/lib/bridge/steps.ts";

const SOURCE_LIST = "src/lib/bridge/SourceTokenList.svelte";
const TARGET_LIST = "src/lib/bridge/TargetTokenList.svelte";
const ROUTE_LIST = "src/lib/bridge/RouteList.svelte";
const PANEL = "src/lib/bridge/AnyToAnyPanel.svelte";
const sourceList = readFileSync(SOURCE_LIST, "utf8");
const targetList = readFileSync(TARGET_LIST, "utf8");
const routeList = readFileSync(ROUTE_LIST, "utf8");
const panel = readFileSync(PANEL, "utf8");

// The four things a user complained about on the first render of this form: stray
// dots, a raw mint where a symbol belongs, no way to compare two routes, and a
// route that never said what it did.

test("the token lists suppress their own list markers", () => {
  // The dots rendered *outside* the list's content box, so they landed left of the
  // card's border and read as a stray marker beside every row. The global reset
  // clears `list-style`, but a component that depends on a stylesheet it does
  // not control is making a bet.
  assert.match(sourceList, /class="list-none[^"]*"/);
  assert.match(targetList, /class="list-none[^"]*"/);
});

test("every alternative route says how far behind the best one it is", () => {
  assert.match(routeList, /percentBehind/);
  assert.match(routeList, /behindOf/);
  // As a percentage of the best route's output, not an absolute difference: the
  // two rows are in the same token, but the numbers are large and differ by an
  // amount nobody can hold in their head.
  assert.match(routeList, /text-amber-300">−\{behindOf\(plan\)\}%/);
});

test("the best route is not labelled as behind itself", () => {
  // `percentBehind` returns 0 for an identical plan, and a "−0%" badge on the row
  // the user is being steered towards would be noise.
  assert.match(routeList, /\(behindOf\(plan\) \?\? 0\) > 0/);
});

test("the plan is spelled out as steps before anything is signed", () => {
  assert.match(panel, /planSteps\(runningPlan \?\? best!, source, dest\)/);
  assert.match(panel, /<RouteSteps/);
  // And it is shown ahead of the button, not only once a transfer is running.
  assert.match(panel, /What happens/);
});

test("the same step list renders the progress, not a second one", () => {
  // A separate progress component is how the two drift apart and the progress
  // ends up promising steps the plan did not have. Now they are literally the
  // same array: `steps` is derived once and both the list and `begin`/`next` read
  // it, so the second press of a NEAR conversion advances the rendered list rather
  // than a local copy that has drifted.
  assert.match(
    panel,
    /\$: steps =\s*\(runningPlan \?\? best\) \? planSteps\(runningPlan \?\? best!, source, dest\) : \[\];/,
  );
  assert.match(panel, /withProgress\(\s*steps,\s*activeStep,\s*stepFailed,/);
  assert.doesNotMatch(panel, /<TransferStatus/);
});

test("the bridge fee names the native token of the sending chain", () => {
  // The native fee is paid out of the wallet's SOL or NEAR and reduces nothing
  // about the amount, so showing only the token fee made the transfer look free.
  assert.match(panel, /costSummary\(best, source\)/);
  assert.doesNotMatch(
    panel,
    /label="Bridge fee"\s*\n?\s*value=\{best\.sourceSwap\s*\n?\s*\?\s*`−/,
  );
});

test("the summary shows a value for the receive amount, not a bare number", () => {
  assert.match(panel, /receiveSummary\(best,/);
});

test("a completed transfer stops the form offering to send again", () => {
  assert.match(panel, /done: transferDone/);
  // Submission is its own state rather than a sum of the step index, so reaching
  // a step is not the same fact as work being under way, and a dismissed wallet
  // popup cannot leave the button disabled forever.
  assert.match(panel, /\$: isSubmitting = transferState === "running";/);
  assert.match(panel, /transferState = "done";/);
  assert.match(panel, /isSubmitting,/);
});

test("a failure is reported on the step that failed", () => {
  // "The swap worked and the bridge did not" is materially different from
  // "nothing happened", and the user needs to know which side their funds are on.
  assert.match(panel, /stepFailed = true/);
  assert.match(panel, /transferError/);
});

test("editing the form clears a finished or failed transfer", () => {
  // Otherwise the progress list keeps rendering a plan the user has invalidated.
  assert.match(
    panel,
    /activeStep = -1;\s*\n\s*stepFailed = false;\s*\n\s*transferDone = false;\s*\n\s*transferError = null;/,
  );
});

function plan(receiveAmount: bigint): RoutePlan {
  return {
    rail: {
      tokenId: "S",
      symbol: "S",
      icon: "/s.webp",
      sourceAddress: "s",
      destAddress: "d",
      sourceDecimals: 9,
      destDecimals: 9,
    },
    sourceSymbol: "A",
    targetSymbol: "T",
    targetDecimals: 9,
    sourceSwap: null,
    targetSwap: null,
    bridgedAmount: 1n,
    tokenFee: 0n,
    nativeFee: 0n,
    usdFee: null,
    arrivedAmount: 1n,
    receiveAmount,
    receiveEstimated: receiveAmount,
  };
}

test("the percentage is against the best route, which is the first", () => {
  const best = plan(1_000_000n);
  assert.equal(percentBehind(plan(1_000_000n), best), 0);
  assert.equal(percentBehind(plan(750_000n), best), 25);
});
