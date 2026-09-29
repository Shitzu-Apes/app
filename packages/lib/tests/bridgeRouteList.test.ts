import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  formatBaseUnits,
  formatBaseUnitsCompact,
} from "../src/bridge/amount.ts";

const LIST = "src/bridge/RouteList.svelte";
const src = readFileSync(LIST, "utf8");

// The route list is the one place the user can see that the rail is a choice.
// These assert the decisions that are easy to regress and impossible to notice:
// showing only the winner, or quietly ranking on the estimate.

test("every route is listed, not just the winner", () => {
  assert.match(src, /#each plans as plan, index/);
  assert.doesNotMatch(src, /plans\[0\]\s*}\s*$/m);
  // A single-route list would hide exactly the case that motivates the feature.
  assert.doesNotMatch(src, /plans\.slice\(0,\s*1\)/);
  assert.doesNotMatch(src, /plans\.slice\(1\)/);
});

test("an empty result explains itself instead of rendering nothing", () => {
  assert.match(src, /plans\.length === 0/);
  assert.match(src, /No way to move that right now/);
});

test("a search in flight is a placeholder, not an empty list", () => {
  // Showing "no route available" while the first quote is still in flight is a
  // claim the app has not earned, and it is the state users see most while
  // typing an amount.
  assert.match(src, /\{#if pending\}/);
  assert.match(src, /aria-busy="true"/);
  assert.match(src, /animate-pulse/);
  // The empty state must come after the pending one, or it wins the race.
  assert.ok(
    src.indexOf("{#if pending}") < src.indexOf("{:else if plans.length === 0}"),
    "the pending branch must be checked first",
  );
});

test("the headline figure is the guaranteed one, and short", () => {
  // The guaranteed figure, not the estimate — and shortened, because the number
  // sits beside another route's number and 19 digits cannot be compared at a
  // glance. `8,949,120,000,000,000 BLACKDRAGON` is wider than the row.
  assert.match(
    src,
    /formatBaseUnitsCompact\(\s*plan\.receiveAmount,\s*plan\.targetDecimals,/,
  );
});

test("the estimate is shown only when it is materially better", () => {
  assert.match(src, /SPREAD_THRESHOLD/);
  assert.match(src, /plan\.receiveEstimated/);
  assert.match(src, /up to \{formatBaseUnitsCompact/);
});

test("a route with no swap says so plainly", () => {
  // The native bridge is still fully supported; it should read as a deliberate
  // choice rather than as a row that is missing something.
  assert.match(src, /Straight bridge, no swap/);
});

test("the venues behind a route are named", () => {
  assert.match(src, /plan\.sourceSwap\?\.dexes/);
  assert.match(src, /plan\.targetSwap\?\.dexes/);
});

test("a plan with no receive amount renders a dash rather than zero", () => {
  assert.match(src, /plan\.receiveAmount === null\s*\?\s*"—"/);
});

// The short scale, and the reason the scale is chosen here rather than by Intl.

test("a large amount is shortened to a mantissa a reader recognises", () => {
  // The two routes in the report: 8,949,120,000,000,000 and 1,492,830,000,000,000
  // of a zero-decimal token, side by side, to be compared.
  assert.equal(formatBaseUnitsCompact(8_949_120_000_000_000n, 0), "8.95Q");
  assert.equal(formatBaseUnitsCompact(1_492_830_000_000_000n, 0), "1.49Q");
});

test("the short scale covers each step", () => {
  assert.equal(formatBaseUnitsCompact(999_900_000_000n, 0), "999.9B");
  assert.equal(formatBaseUnitsCompact(2_500_000n, 0), "2.5M");
  assert.equal(formatBaseUnitsCompact(12_000n, 0), "12K");
});

test("a small amount keeps every digit", () => {
  // Precision is the point at this size, and a balance of 1.5 is not improved by
  // being written 1.5.
  assert.equal(formatBaseUnitsCompact(1_500_000n, 9), "0.0015");
  assert.equal(formatBaseUnitsCompact(123_456_789n, 6), "123.457");
  // Just under the threshold too, where abbreviating would only lose information.
  assert.equal(formatBaseUnitsCompact(9_999n, 6), "0.009999");
});

test("the short form is never longer than the long one", () => {
  // The whole point is width. If a case ever comes out longer, the abbreviation
  // has cost space rather than saved it.
  for (const [base, decimals] of [
    [8_949_120_000_000_000n, 0],
    [1_492_830_000_000_000n, 0],
    [999_900_000_000n, 0],
    [2_500_000n, 0],
    [12_000n, 0],
  ] as [bigint, number][]) {
    assert.ok(
      formatBaseUnitsCompact(base, decimals).length <=
        formatBaseUnits(base, decimals).length,
      `${base} did not get shorter`,
    );
  }
});
