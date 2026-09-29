import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

/** Read a file relative to the repository root. */
const repo = (p: string) =>
  readFileSync(
    fileURLToPath(new URL(`../../../${p}`, import.meta.url)),
    "utf8",
  );

const PAGE = "apps/shitzu-app/src/routes/bridge/+page.svelte";
const src = repo(PAGE);

// The toggle is the one place the two flows meet, so these check that neither can
// quietly take over the other: the existing six-chain bridge must keep working
// exactly as before, and the new panel must not be reachable until it is asked for.

test("the header sits above the toggle, not below it", () => {
  // The header names the page, not a mode: both flows are the same bridge, and
  // the toggle is a choice about what to send rather than about where you are.
  const header = src.indexOf("OmniBridge");
  const toggle = src.indexOf('role="tablist"');
  assert.ok(header !== -1, "the page header must be on the page");
  assert.ok(toggle !== -1);
  assert.ok(
    header < toggle,
    "the header must be rendered before the mode toggle",
  );
});

test("the header belongs to the page, not to one panel", () => {
  // It used to live inside the native panel, which meant the Convert tab had no
  // title at all and the two tabs looked like different pages.
  assert.match(src, /<h1 class="mb-0">OmniBridge<\/h1>/);
  const panel = readFileSync("src/bridge/NativeBridgePanel.svelte", "utf8");
  assert.doesNotMatch(panel, /<h1/);
  // The explainer sheet is about the bridge as a whole, so it belongs with the
  // header rather than with the legacy form.
  assert.match(src, /openBottomSheet\(OmniBridgeSheet\)/);
  assert.doesNotMatch(panel, /OmniBridgeSheet/);
});

test("the page offers both flows, and Convert leads", () => {
  assert.match(src, /id: "bridge"/);
  assert.match(src, /id: "convert"/);
  // Converting between tokens is what this page is for; bridging a token
  // unchanged is the older, narrower job and stays one tap away.
  assert.match(src, /let mode: Mode = "convert"/);
  // And it is listed first, so the tab order matches the default.
  assert.ok(
    src.indexOf('id: "convert"') < src.indexOf('id: "bridge"'),
    "Convert must be the first tab",
  );
});

test("only one panel is mounted at a time", () => {
  assert.match(
    src,
    /\{#if mode === "bridge"\}[\s\S]*<NativeBridgePanel \/>[\s\S]*\{:else\}[\s\S]*<AnyToAnyPanel \/>/,
  );
});

test("the toggle is a real tablist, not two bare buttons", () => {
  assert.match(src, /role="tablist"/);
  assert.match(src, /role="tab"/);
  assert.match(src, /aria-selected=\{mode === tab\.id\}/);
});

test("each tab says what it does, because the names alone are ambiguous", () => {
  // "Bridge" and "Convert" read as synonyms to anyone who has not met the
  // distinction, and picking the wrong one costs a signature.
  assert.match(src, /hint: "Move a token unchanged"/);
  assert.match(src, /hint: "Swap into any token on the other chain"/);
});

test("the native panel was moved, not rewritten", () => {
  // The existing flow is 1200 lines of per-chain signing that must not have
  // changed. It is asserted here as a file that still exists at its new home, so
  // a future edit to the toggle cannot quietly delete it.
  const panel = readFileSync("src/bridge/NativeBridgePanel.svelte", "utf8");
  assert.match(panel, /<TransferStatus/);
  assert.match(panel, /<UserMenu/);
  // The EVM chains are only reachable from here, so they must still be wired.
  for (const chain of ["base", "arbitrum", "ethereum", "bnb"]) {
    assert.match(panel, new RegExp(`"${chain}"`));
  }
});
