import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * The late-failure recoveries, pinned where they live.
 *
 * The reported failure: the bridge finalised, the destination swap could not be
 * quoted, and the form was left on a spent source balance with its only button
 * disabled above a sentence telling the user to "swap them from the token list".
 * The money was in the wallet and the app offered no way to reach it, which is
 * the state these tests exist to keep from coming back.
 *
 * The panel is a Svelte component and these are source-text assertions, which is
 * the convention this repository already uses for the panel (`bridgeConvertUi`):
 * the wiring is the behaviour, and svelte-check cannot see an affordance that is
 * simply missing.
 */

const PANEL = "src/bridge/AnyToAnyPanel.svelte";
const panel = readFileSync(PANEL, "utf8");
const solanaLeg = readFileSync("src/bridge/executeSolanaSwapLeg.ts", "utf8");
const nearLeg = readFileSync("src/bridge/executeNear.ts", "utf8");

/** A top-level function's body, by its opening line and closing brace. */
function body(source: string, opening: string): string {
  const start = source.indexOf(opening);
  assert.ok(start > 0, `${opening} is present`);
  return source.slice(start, source.indexOf("\n  }\n", start));
}

test("a failed destination swap keeps the amount that arrived", () => {
  // The retry and the manual route are both built from this number, and it exists
  // nowhere else once the call has returned: `landedAmount` is only set on the
  // NEAR park, so the Solana path would have had nothing to retry with.
  const fn = body(panel, "async function runFinalLeg(");
  assert.match(fn, /tailFailed = \{ amount: amountIn \};/);
  // Recorded as a late failure, after the bridge has succeeded — not as a second
  // kind of error message.
  assert.ok(
    fn.indexOf("tailFailed = { amount: amountIn }") >
      fn.indexOf("[bridge] final swap failed"),
    "the failure is recorded in the catch that saw it",
  );
  // And a retry starts clean, so a stale card cannot outlive the attempt.
  assert.match(fn, /tailFailed = null;/);
});

test("the two recoveries are presses, not instructions", () => {
  const card = panel.slice(panel.indexOf("{#if tailFailed}"));
  assert.match(card, /on:click=\{retryFinalLeg\}/);
  assert.match(card, /on:click=\{swapManually\}/);
  // The copy says what is true in the order the user needs it: the money arrived.
  assert.match(panel, /arrived on \{CHAINS\[dest\]/);
  assert.match(card, /tokens are safe in your wallet/);
  // Comments in the component quote the old instruction to explain why it went,
  // so they are stripped before checking the markup that actually renders.
  const markup = card.replace(/<!--[\s\S]*?-->/g, "");
  assert.doesNotMatch(markup, /token list/);
});

test("the retry re-quotes the amount that arrived, not a fresh plan", () => {
  const retry = body(panel, "async function retryFinalLeg()");
  assert.match(retry, /runFinalLeg\(tailFailed\.amount\)/);
  // It is a fresh attempt, so the red step and the stale message go with it.
  assert.match(retry, /stepFailed = false;/);
  assert.match(retry, /transferError = null;/);
});

test("the manual route becomes the same-chain swap it actually is", () => {
  // After the bridge, converting the rail into the target is a plain swap on the
  // chain the tokens landed on — no bridge, no second wallet. The form is pointed
  // at that and the ordinary search prices it, which is what "swap them from the
  // token list" was asking the user to work out by hand.
  const fn = body(panel, "function swapManually()");
  assert.match(fn, /source = dest;/);
  assert.match(
    fn,
    /dest === "near" \? railAssetOnArrival\(rail, "near"\) : rail\.destAddress/,
    "the rail is selected as the source token on the chain it arrived on",
  );
  assert.match(
    fn,
    /formatBaseUnitsExact\(arrival\.amount, rail\.destDecimals\)/,
  );
  // And the previous conversion's facts are cleared before the reset, or
  // `clearAttempt` re-parks the transfer on a deposit that has already been paid
  // out — the button would offer to bridge the money that just arrived.
  const clear = fn.indexOf("swapLeg = null;");
  const reset = fn.indexOf("reset();");
  assert.ok(clear > 0 && reset > clear, "cleared before the reset");
});

test("a recalculation does not erase a failure the wallet still remembers", () => {
  // No edit to the form can un-arrive the money, so the recovery survives the
  // recalculation that a balance change triggers — and, just as importantly, does
  // not fall through to the park below, which exists for a different situation
  // entirely: a signed source swap with nothing bridged.
  const fn = body(panel, "function clearAttempt()");
  const guard = fn.indexOf("if (tailFailed) return;");
  const park = fn.indexOf('transferState = "awaiting-deposit"');
  const idle = fn.indexOf('transferState = "idle"');
  assert.ok(guard > 0, "the recovery is guarded");
  assert.ok(park > guard, "and the deposit park is never reached with it set");
  assert.ok(idle > guard, "and it is not reset to idle either");
});

test("the form is never left with a dead button under a live recovery", () => {
  // The old state: the source balance was spent, so the gate disabled the button
  // ("Insufficient balance") while the arrival sat in the destination wallet. A
  // late failure keeps the button pressable as a way out.
  assert.match(
    panel,
    /\$: canPress =\s*\n?\s*transferDone \|\| tailFailed !== null \|\| parkedPress \|\| gate\.canSubmit;/,
  );
  assert.match(
    panel,
    /if \(transferDone \|\| tailFailed\) return startAnother\(\);/,
  );
  assert.match(
    panel,
    /\{transferDone \|\| tailFailed\s*\n?\s*\? "Start another conversion"/,
  );
});

test("changing a chain or starting again drops a stale recovery", () => {
  // The recovery names a chain, a rail and a target, and its retry is built from
  // `runningPlan` — which `reset` forgets. So it is cleared in `reset`, the one
  // place every abandonment passes through: both chain pickers, a target change,
  // the manual route, and starting over. A new transfer does not call `reset`, so
  // it clears the card itself.
  assert.match(body(panel, "function reset("), /tailFailed = null;/);
  assert.match(
    body(panel, "async function startTransfer()"),
    /tailFailed = null;/,
  );
});

test("the executor no longer outsources the recovery to the user", () => {
  // "Your tokens have arrived — swap them from the token list" was the string the
  // user saw in the console and on screen. It names work and leaves the form in a
  // state that cannot do it; the sentence is gone from both destination legs and
  // the panel owns the recovery now.
  for (const [name, source] of [
    ["solana", solanaLeg],
    ["near", nearLeg],
  ] as const) {
    assert.doesNotMatch(
      source,
      /swap them from the token list/,
      `${name} does not name the token list`,
    );
  }
  assert.match(solanaLeg, /No swap route is available/);
  assert.match(nearLeg, /No swap route is available/);
  // The one thing the NEAR leg must keep saying, because it is a different
  // failure: the wallet did not sign, so nothing was swapped.
  assert.match(nearLeg, /did not sign the swap/);
});
