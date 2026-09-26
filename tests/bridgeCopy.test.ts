import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { SWAP_TOKENS } from "../src/lib/solana/jupiter.ts";

const SHEET =
  "src/lib/components/memecooking/BottomSheet/SolToNearBridgeSheet.svelte";

// Users should never be shown the wrapped-token name or a venue name. The
// underlying mint is still wNEAR, but the UI talks about NEAR.
const FORBIDDEN_IN_UI = [/wNEAR/, /Ref Finance/i];

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
  const src = readFileSync("src/lib/bridge/solanaToNear.ts", "utf8");
  // Only inspect string literals, not the internal WNEAR_MINT identifier.
  const literals = src.match(/"[^"\n]*"/g) ?? [];
  for (const literal of literals) {
    assert.doesNotMatch(literal, /wNEAR/, literal);
  }
});

test("the bridge gate's labels avoid wNEAR", () => {
  const src = readFileSync("src/lib/bridge/amount.ts", "utf8");
  const literals = src.match(/"[^"\n]*"/g) ?? [];
  for (const literal of literals) {
    assert.doesNotMatch(literal, /wNEAR/, literal);
  }
});
