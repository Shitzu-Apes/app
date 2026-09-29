import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { SWAP_TOKENS } from "../src/solana/jupiter.ts";

const SHEET =
  "src/components/memecooking/BottomSheet/SolToNearBridgeSheet.svelte";

// Users should never be shown the wrapped-token name or a venue name. The
// underlying mint is still wNEAR, but the UI talks about NEAR.
const FORBIDDEN_IN_UI = [/wNEAR/, /Ref Finance/i];

test("the progress panel makes no timing claim", () => {
  // It said "this usually takes a couple of minutes". Measured against a real
  // completed transfer, the bridge indexed and finalised in 23 seconds, so the
  // claim was wrong by roughly an order of magnitude. Rather than swap in a
  // different estimate, the panel says nothing: the phase list already shows
  // where the transfer is.
  const sheet = readFileSync(SHEET, "utf8");
  for (const claim of [
    /couple of minutes/i,
    /takes? a (?:minute|few minutes)/i,
    /usually takes/i,
    /in a minute/i,
    /in about \d+/i,
  ]) {
    assert.doesNotMatch(sheet, claim, `stale timing copy: ${claim}`);
  }
  // The poll footer went entirely, including its "check N of M" counter.
  assert.doesNotMatch(sheet, /Check \{poll\.attempt\}/);
  assert.doesNotMatch(sheet, /close this sheet safely/i);
});

test("the sheet carries no explanatory prose under the button", () => {
  // It read "This swaps USDC to NEAR on Solana, then bridges it to your Near
  // account. You sign two transactions." The route is already stated by the
  // From/To cards and the summary's Route row, so the paragraph was pure
  // repetition.
  const sheet = readFileSync(SHEET, "utf8");
  assert.doesNotMatch(sheet, /This swaps/);
  assert.doesNotMatch(sheet, /This bridges your/);
  assert.doesNotMatch(sheet, /You sign two transactions/);
});

test("the progress panel still shows the phase list", () => {
  // Removing the footer must not remove the only progress signal.
  const sheet = readFileSync(SHEET, "utf8");
  assert.match(sheet, /\{#if poll\}/);
  assert.match(sheet, /\{#each PHASES as p\}/);
  assert.match(sheet, /\{PHASE_LABELS\[p\]\}/);
});

test("the NEAR source token is labelled plainly", () => {
  assert.equal(SWAP_TOKENS.WNEAR.symbol, "NEAR");
  // The mint must remain the real bridged token.
  assert.equal(
    SWAP_TOKENS.WNEAR.mint,
    "3ZLekZYq2qkZiSpnSvabjit34tUkjSwD1JFuW9as9wBG",
  );
});

test("no source token is labelled wNEAR", () => {
  for (const token of Object.values(SWAP_TOKENS)) {
    assert.doesNotMatch(token.symbol, /wNEAR/, token.symbol);
  }
});

/**
 * Only what a user can actually read: the rendered markup plus quoted string
 * literals. Internal identifiers and code comments may still say wNEAR, since
 * that is the real on-chain asset.
 */
function userFacing(source: string): string {
  const markup = source.slice(source.indexOf("</script>"));
  const script = source.slice(0, source.indexOf("</script>"));
  const literals = (script.match(/"[^"\n]*"|'[^'\n]*'/g) ?? []).join("\n");
  return `${literals}\n${markup}`;
}

test("the bridge sheet never renders wNEAR or names a venue", () => {
  const visible = userFacing(readFileSync(SHEET, "utf8"));
  for (const pattern of FORBIDDEN_IN_UI) {
    assert.doesNotMatch(visible, pattern, `sheet must not show ${pattern}`);
  }
});

test("the bridge module's user-facing messages avoid wNEAR", () => {
  const src = readFileSync("src/bridge/solanaToNear.ts", "utf8");
  // Only inspect string literals, not the internal WNEAR_MINT identifier.
  const literals = src.match(/"[^"\n]*"/g) ?? [];
  for (const literal of literals) {
    assert.doesNotMatch(literal, /wNEAR/, literal);
  }
});

test("the bridge gate's labels avoid wNEAR", () => {
  const src = readFileSync("src/bridge/amount.ts", "utf8");
  const literals = src.match(/"[^"\n]*"/g) ?? [];
  for (const literal of literals) {
    assert.doesNotMatch(literal, /wNEAR/, literal);
  }
});
