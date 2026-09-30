import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * What survives an attempt, and what goes with it.
 *
 * The reported state: after a conversion — a failed one especially — the form was
 * describing two different transfers at once. The route above was priced for the
 * token and amount on screen, while "What happens" was still the previous
 * attempt's swap, because `runningPlan` is deliberately sticky for the duration of
 * a transfer and nothing dropped it when the attempt ended. A failure's message
 * went the other way: it was cleared about four hundred milliseconds after being
 * shown, by the recalculation the failure itself triggered.
 *
 * The panel is a Svelte component and these are source-text assertions, which is
 * the convention this repository already uses for it (`bridgeConvertUi`,
 * `bridgeTailFailure`): the wiring is the behaviour, and svelte-check cannot see a
 * value that is never cleared.
 */

const PANEL = "src/bridge/AnyToAnyPanel.svelte";
const TARGET_LIST = "src/bridge/TargetTokenList.svelte";
const panel = readFileSync(PANEL, "utf8");
const targetList = readFileSync(TARGET_LIST, "utf8");

/** A top-level function's body, by its opening line and closing brace. */
function body(source: string, opening: string): string {
  const start = source.indexOf(opening);
  assert.ok(start > 0, `${opening} is present`);
  return source.slice(start, source.indexOf("\n  }\n", start));
}

test("a source token that changes itself resets the form like a click does", () => {
  // The click went through `reset()`; the fallbacks that re-point the selection from
  // a balance read did not. So a token that vanished from the wallet silently
  // replaced the selection, the amount was re-parsed at the new token's decimals,
  // and the previous attempt stayed on screen under a route priced for the new one.
  const pick = body(panel, "function pickSourceToken(id: string)");
  assert.match(pick, /if \(id === sourceTokenId\) return;/);
  assert.match(pick, /sourceTokenId = id;\s*\n\s*reset\(\);/);

  // Both fallbacks go through the read's version: the NEAR list's and the Solana
  // list's.
  const blocks = panel.slice(
    panel.indexOf("// A chain change invalidates the selection"),
    panel.indexOf("* On NEAR only native NEAR is offered"),
  );
  assert.match(blocks, /followHeldSourceToken\(sourceOptions\[0\]\.id\);/);
  assert.match(
    blocks,
    /followHeldSourceToken\(solanaTokens\[0\]\?\.mint \?\? WSOL_MINT\);/,
  );

  // A read is not a decision, so its version refuses while the form is the record
  // of a transfer the chain has already been told about. Without this, the token a
  // transfer just spent — gone from the next read of the wallet — would reset the
  // form that holds its signed swap and the press that bridges it.
  const follow = body(panel, "function followHeldSourceToken(id: string)");
  assert.match(follow, /if \(!selectionIsFree\) return;/);
  assert.match(follow, /pickSourceToken\(id\);/);
  assert.match(panel, /selectionIsFree =\s*\n?\s*transferState === "idle"/);

  // The Solana one only fires while there are rows to choose from. An empty read is
  // a load in flight, not a wallet holding nothing, and rewriting the selection
  // there cleared a form the user was working on over an answer that had not
  // arrived.
  const solanaStart = blocks.indexOf('source === "solana"');
  const solanaEnd = blocks.indexOf("WSOL_MINT);", solanaStart);
  assert.ok(
    solanaStart > 0 && solanaEnd > solanaStart,
    "the Solana block is present",
  );
  const solana = blocks.slice(solanaStart, solanaEnd);
  assert.match(solana, /solanaTokens\.length > 0 &&/);
  assert.match(solana, /!solanaTokens\.some\(/);

  // And the loader's own fallback for a spent token, which is the case the report
  // came from: the token the transfer just used up is gone from the next read.
  const load = body(panel, "async function loadSolanaTokens(");
  assert.match(load, /found\.length > 0 &&/);
  assert.match(load, /followHeldSourceToken\(/);
  // The picker itself, so a click and a read cannot disagree about the path.
  assert.match(panel, /on:select=\{\(e\) => pickSourceToken\(e\.detail\)\}/);
});

test("an abandoned attempt takes its plan with it", () => {
  // This is what "What happens" renders. Left behind, it kept showing the swap and
  // the amount of a conversion that had already ended, under a route priced for the
  // one now on screen — the screenshot this came from.
  const fn = body(panel, "function clearAttempt()");
  const abandoned = fn.indexOf("if (!swapStillApplies) {");
  assert.ok(abandoned > 0, "the abandoned branch is present");
  const branch = fn.slice(abandoned, fn.indexOf("return;", abandoned));
  assert.match(branch, /swapLeg = null;/);
  assert.match(branch, /landedAmount = null;/);
  assert.match(branch, /runningPlan = null;/);
  assert.match(branch, /transferState = "idle";/);
});

test("a failure is paused, not erased by the search it triggers", () => {
  // `runSearch` clears the previous attempt on the way in, and a failed transfer
  // lifts its own pause — so the recalculation the failure triggers was clearing the
  // message and the red step about four hundred milliseconds after showing them.
  const pause = panel.slice(
    panel.indexOf("$: searchPaused ="),
    panel.indexOf("// The raw inputs are named here"),
  );
  assert.match(pause, /transferState === "failed"/);
  // And the clear is gated on the form having moved since the plan was priced: a
  // search that runs because the pause lifted is the same question asked again.
  assert.match(
    panel,
    /if \(transferState !== "running" && formChangedSincePricing\) clearAttempt\(\);/,
  );
});

test("a failed leg never ticks the conversion over to done", () => {
  // The destination swap's failure handler returns to `afterBridge`, which calls
  // `next()` unconditionally. A tick there marked the conversion done and opened a
  // receipt on the quote for a swap that never ran, with the recovery card
  // underneath saying it had failed.
  const fn = body(panel, "function next() {");
  const guard = fn.indexOf('if (transferState === "failed") return;');
  const finish = fn.indexOf("transferDone = true;");
  assert.ok(
    guard > 0 && finish > guard,
    "the failed case returns before the tick",
  );
});

test("a failed deposit parks on the press that retries it", () => {
  // The swap is signed and the rail is in the account, so what failed is the
  // deposit. A generic failure put "Convert" under the form — a press that re-runs
  // the source swap, i.e. a second swap for money already sitting in the rail.
  const fn = body(panel, "async function runDepositPress()");
  const failed = fn.indexOf("[bridge] deposit failed");
  const finallyAt = fn.indexOf("} finally {", failed);
  assert.ok(
    failed > 0 && finallyAt > failed,
    "the catch and its exit are present",
  );
  assert.match(
    fn.slice(failed, finallyAt),
    /transferState = "awaiting-deposit";/,
  );
});

test("a new attempt does not inherit the last one's receipt or error", () => {
  // `receivedAmount` outranks the plan's own figure in the receipt, so a value left
  // over from a previous conversion is a receipt quoting the wrong transfer. The
  // message would be the previous failure's, shown under an attempt that is still
  // running.
  const fn = body(panel, "async function startTransfer()");
  assert.match(fn, /receivedAmount = null;/);
  assert.match(fn, /transferError = null;/);
});

test("a destination change drops the type-ahead that belonged to the old chain", () => {
  // Otherwise the new chain renders under a placeholder naming it while the list
  // under it is the old chain's hits — tokens it cannot receive — and the query that
  // asked for them is still in the box.
  const pick = body(panel, "function pickDest(chain: ConvertChain)");
  assert.match(pick, /clearSuggest\(\);/);
  const clear = body(panel, "function clearSuggest()");
  assert.match(clear, /suggestions = \[\];/);
  assert.match(clear, /suggestFor = "";/);
  // And the input itself, which the panel cannot reach.
  assert.match(targetList, /\$: if \(network !== lastNetwork\) \{/);
  assert.match(targetList, /lastNetwork = network;/);
  assert.match(targetList, /query = "";/);
});
