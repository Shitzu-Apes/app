import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

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

test("price impact is omitted entirely", () => {
  // It was a row that either said "Negligible" or appeared conditionally. The
  // requirement is that it is not shown at all, so neither form may return.
  assert.doesNotMatch(sheet, /Negligible/);
  assert.doesNotMatch(sheet, /label="Price impact"/);
  assert.doesNotMatch(sheet, /priceImpactPct/);
});

test("every summary row is rendered up front, each with a pending state", () => {
  // Route, swap output/amount, bridge fee, net.
  const rows = sheet.match(/<SummaryRow/g) ?? [];
  assert.equal(rows.length, 4, "expected 4 summary rows");
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
  assert.match(sheet, /class="space-y-4 transition-opacity duration-200"/);
});

test("the form is not blanked while a transfer runs", () => {
  // Clicking the button used to hide the entire form, so the modal emptied out
  // before the wallet had even asked for a signature and the from/to context
  // vanished at the moment it was needed. Only a landed transfer hides it.
  assert.match(sheet, /class:hidden=\{done\}/);
  assert.doesNotMatch(sheet, /class:hidden=\{isBridging/);
  // It goes visibly inert instead, and the inputs are already disabled.
  assert.match(sheet, /class:opacity-50=\{isBridging && !done\}/);
  assert.match(sheet, /class:pointer-events-none=\{isBridging && !done\}/);
  assert.match(sheet, /aria-busy=\{isBridging && !done\}/);
  assert.match(sheet, /disabled=\{isBridging\}/);
});

test("every form control refuses input during a transfer", () => {
  // The form stays on screen now, so each control has to refuse input itself
  // rather than relying on the wrapper being display:none.
  const at = (needle: string) => sheet.indexOf(needle);

  const input = sheet.slice(at("<input"), at("<input") + 400);
  assert.ok(at("<input") > -1, "expected the amount input");
  assert.match(input, /disabled=\{isBridging\}/, "the amount input stays live");

  const tokenRow = sheet.slice(
    at("on:click={() => selectToken") - 400,
    at("on:click={() => selectToken"),
  );
  assert.match(
    tokenRow,
    /disabled=\{isBridging\}/,
    "token rows must be disabled",
  );

  assert.match(
    sheet,
    /disabled=\{isBridging \|\| !available \|\| available <= 0n\}/,
    "the percentage buttons must be disabled",
  );

  // Nothing inside the form wrapper may be left clickable. The only handlers
  // that survive are the two wallet-connect prompts, which cannot render while
  // a transfer is running because both wallets are connected by then.
  const wrapperEnd = sheet.indexOf("\n    </div>\n", at("class:hidden={done}"));
  assert.ok(wrapperEnd > at("class:hidden={done}"), "wrapper must exist");
  const form = sheet.slice(at("class:hidden={done}"), wrapperEnd);
  // A disabled button still carries its handler, so each one is checked
  // together with the tag it sits in.
  const clicks = [...form.matchAll(/on:click=\{([^}]*)\}/g)];
  assert.ok(clicks.length > 0, "expected handlers inside the form");
  for (const click of clicks) {
    const handler = click[1];
    // The wallet prompts cannot render mid-transfer: both wallets are
    // connected by then.
    if (/requireNearWallet|requireSolanaWallet/.test(handler)) continue;

    const open = form.lastIndexOf("<button", click.index);
    const tag = form.slice(open, form.indexOf(">", open) + 1);
    assert.ok(
      open > -1 && tag.includes(">"),
      `could not locate the button for ${handler}`,
    );
    assert.match(
      tag,
      /disabled=\{[^}]*isBridging/,
      `a control inside the form is live during a transfer: ${tag.replace(/\s+/g, " ").slice(0, 110)}`,
    );
  }
});

test("the primary action sits outside the hidden form", () => {
  // The submit button used to live inside the `class:hidden` wrapper, so it
  // disappeared during a transfer and the success panel could never show.
  const hiddenAt = sheet.indexOf("class:hidden={done}");
  const wrapperEnd = sheet.indexOf("\n    </div>\n", hiddenAt);
  const buttonAt = sheet.indexOf("on:click={done ? finish : onSubmit}");
  const donePanel = sheet.indexOf("{#if done}");
  assert.ok(hiddenAt > -1 && wrapperEnd > hiddenAt, "wrapper must exist");
  assert.ok(buttonAt > wrapperEnd, "submit button must be outside the wrapper");
  assert.ok(donePanel > -1 && donePanel > hiddenAt);
});
