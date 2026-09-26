import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const SHEET =
  "src/lib/components/memecooking/BottomSheet/SolToNearBridgeSheet.svelte";
const ROW = "src/lib/components/memecooking/BottomSheet/SummaryRow.svelte";
const src = (f: string) => readFileSync(f, "utf8");

const sheet = src(SHEET);
const row = src(ROW);

test("the summary card is always rendered, not conditionally", () => {
  // It used to be gated on `needsSwap || bridgedWnear !== null`, which made the
  // whole card pop in once a quote landed.
  assert.doesNotMatch(
    sheet,
    /\{#if needsSwap \|\| bridgedWnear !== null\}/,
    "card must not be conditionally rendered",
  );
  // There is exactly one card element for the summary.
  const cards = sheet.match(/You receive on Near/g) ?? [];
  assert.equal(cards.length, 1, "expected a single summary card");
});

test("the fee is a single row covering both NEAR and SOL", () => {
  // Splitting the cost across "Bridge fee" and "Solana network fee" rows was
  // noise; it is one number now, formatted as `x NEAR / y SOL`.
  assert.match(
    sheet,
    /label="Bridge fee"[\s\S]*?feeQuote\.tokenFee[\s\S]*?\/[\s\S]*?feeQuote\.nativeFee[\s\S]*?SOL/,
  );
  assert.doesNotMatch(sheet, /Solana network fee/);
  assert.equal((sheet.match(/label="Bridge fee"/g) ?? []).length, 1);
});

test("the usd estimate is no longer shown", () => {
  assert.doesNotMatch(sheet, /usdFee/);
});

test("price impact is omitted rather than labelled negligible", () => {
  assert.doesNotMatch(sheet, /Negligible/);
  // It only appears when it is actually worth warning about.
  assert.match(
    sheet,
    /\{#if quote && Number\(quote\.priceImpactPct\) > 0\.01\}[\s\S]*?label="Price impact"/,
  );
});

test("every summary row is rendered up front, each with a pending state", () => {
  // Route, swap output/amount, bridge fee, net. Price impact is conditional on
  // being meaningful.
  const rows = sheet.match(/<SummaryRow/g) ?? [];
  assert.equal(rows.length, 5, "expected 5 summary rows");
  for (const label of ["Route", "Bridge fee", "You receive on Near"]) {
    assert.ok(sheet.includes(`label="${label}"`), `missing row: ${label}`);
  }
  // The amount row's label switches on the source token.
  assert.match(
    sheet,
    /label=\{needsSwap \? "Swap output" : "Amount"\}/,
    "missing the swap output / amount row",
  );
});

test("the row shows a placeholder instead of hiding the value slot", () => {
  assert.match(row, /pending \|\| value === null/);
  assert.match(row, /animate-pulse/);
  // The value slot renders in the same place whether pending or not.
  assert.match(
    row,
    /\{#if pending \|\| value === null\}[\s\S]*\{:else\}[\s\S]*\{value\}/,
  );
});

test("no row is wrapped in a conditional that would remove it", () => {
  // Guard against reintroducing per-row {#if} wrappers around SummaryRow.
  assert.doesNotMatch(
    sheet,
    /\{#if bridgedWnear !== null && bridgedWnear > 0n\}\s*<SummaryRow/,
  );
  assert.doesNotMatch(sheet, /\{#if feeQuote\}\s*<SummaryRow/);
});

test("pending is driven by the real loading flags, not by absence of data", () => {
  assert.match(sheet, /pending=\{isQuotingFee\}/);
  assert.match(sheet, /pending=\{!noRoute && !quote\}/);
});

test("the fee row shows a minus sign so the deduction is obvious", () => {
  assert.match(sheet, /\\u2212\$\{formatBaseUnits\(feeQuote\.tokenFee/);
});
test("the form wrapper keeps its own spacing", () => {
  // A plain wrapper div swallowed the section's `space-y-4`, so the cards ended
  // up flush against each other.
  assert.match(
    sheet,
    /<div class="space-y-4" class:hidden=\{isBridging \|\| done\}>/,
  );
});

test("the primary action sits outside the hidden form", () => {
  // The submit button used to live inside the `class:hidden` wrapper, so it
  // disappeared during a transfer and the success panel could never show.
  const hiddenAt = sheet.indexOf("class:hidden={isBridging || done}");
  const wrapperEnd = sheet.indexOf("\n    </div>\n", hiddenAt);
  const buttonAt = sheet.indexOf("on:click={done ? finish : onSubmit}");
  const donePanel = sheet.indexOf("{#if done}");
  assert.ok(hiddenAt > -1 && wrapperEnd > hiddenAt, "wrapper must exist");
  assert.ok(buttonAt > wrapperEnd, "submit button must be outside the wrapper");
  assert.ok(donePanel > -1 && donePanel > hiddenAt);
});
