import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const CONTAINER = "src/layout/BottomSheet/Container.svelte";
const HEADER = "src/layout/memecooking/MCHeader.svelte";
const src = (f: string) => readFileSync(f, "utf8");

test("openBottomSheet accepts a dismissible option", () => {
  const s = src(CONTAINER);
  assert.match(
    s,
    /options\?: \{ dismissible\?: boolean \}/,
    "expected a dismissible option",
  );
  // Default stays true so every existing caller is unaffected.
  assert.match(s, /dismissible\$\.set\(options\?\.dismissible \?\? true\)/);
});

test("a non-dismissible sheet has no clickable backdrop", () => {
  const s = src(CONTAINER);
  assert.match(s, /\{#if \$dismissible\$\}/);
  // The dismissing button must live inside that guard only.
  const guarded = s.slice(s.indexOf("{#if $dismissible$}"));
  assert.match(guarded, /on:click=\{closeBottomSheet\}/);
  // And the fallback must not be able to close it.
  const fallback = s.slice(s.indexOf("{:else}"), s.indexOf("{/if}"));
  assert.doesNotMatch(fallback, /closeBottomSheet/);
});

test("the fallback still blocks the tap and paints the scrim", () => {
  const s = src(CONTAINER);
  assert.match(
    s,
    /<!-- Absorb the tap[\s\S]*?<div class="fixed inset-0 bg-black\/80 z-30" \/>/,
  );
});

test("the bridge sheet opens non-dismissible", () => {
  // The sheet is loaded lazily now, so assert on the call shape plus the
  // non-dismissible option rather than on the component identifier.
  assert.match(
    src(HEADER),
    /openBottomSheet\(\s*LazySheet,\s*\{[\s\S]*?SolToNearBridgeSheet\.svelte[\s\S]*?\},\s*"m",\s*\{\s*dismissible: false\s*\},\s*\)/,
  );
});

test("the close button is still available", () => {
  // Only outside clicks are blocked; the explicit X must keep working.
  const s = src(CONTAINER);
  assert.match(s, /on:click=\{closeBottomSheet\}[\s\S]*?i-mdi:close/);
});
