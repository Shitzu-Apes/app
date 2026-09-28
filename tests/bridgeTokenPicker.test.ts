import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SHEET =
  "src/lib/components/memecooking/BottomSheet/SolToNearBridgeSheet.svelte";
const sheet = readFileSync(SHEET, "utf8");

/** The "Pay with" block, up to the amount field that follows it. */
function pickerSection(): string {
  const start = sheet.indexOf("Pay with");
  assert.ok(start > -1, "expected a Pay with section");
  const end = sheet.indexOf(">Amount<", start);
  return end > -1 ? sheet.slice(start, end) : sheet.slice(start, start + 3000);
}

test("the picker is a scrollable list, not cards", () => {
  // It was a 3-column grid of at most six cards, which hid the holdings the
  // user actually recognised.
  const picker = pickerSection();
  assert.match(picker, /<ul[\s\S]*overflow-y-auto/);
  assert.match(picker, /\{#each walletTokens as token \(token\.mint\)\}/);
  assert.doesNotMatch(sheet, /MAX_VISIBLE_TOKENS/);
  assert.doesNotMatch(sheet, /hiddenTokenCount/);
  assert.doesNotMatch(sheet, /Show fewer/);
  assert.doesNotMatch(sheet, /grid-cols-3[\s\S]{0,200}sourceMint/);
});

test("every holding is listed, with no cap", () => {
  // The whole point: USDC and SOL were below the fold because of a hard cap.
  assert.match(sheet, /\{#each walletTokens as token \(token\.mint\)\}/);
  assert.doesNotMatch(sheet, /walletTokens\.slice\(0/);
});

test("the amount field is present", () => {
  // Regression guard. An edit that replaced too wide a block once removed the
  // input entirely, leaving no way to specify an amount at all.
  assert.match(sheet, /<input[\s\S]{0,400}bind:value=\{amountInput\}/);
  assert.match(sheet, /inputmode="decimal"/);
  assert.match(sheet, /placeholder="0\.0"/);
  assert.match(sheet, /\{source\.symbol\}/);
});

test("the summary, warnings and submit button survive alongside the picker", () => {
  // Same regression: the summary card, the balance warnings and the button all
  // disappeared together with the amount field.
  assert.match(sheet, /label="Route"/);
  assert.match(sheet, /label="Bridge fee"/);
  assert.match(sheet, /label="You receive on Near"/);
  assert.match(sheet, /gate\.insufficientBalance/);
  assert.match(sheet, /gate\.insufficientSol/);
  assert.match(sheet, /on:click=\{done \? finish : onSubmit\}/);
});

test("quick-fill percentages are offered", () => {
  assert.match(sheet, /const PERCENTS = \[25, 50, 75, 100\]/);
  assert.match(sheet, /function setPercent\(percent: number\)/);
  assert.match(sheet, /\{#each PERCENTS as pct\}/);
  assert.match(sheet, /\{pct\}%/);
});

test("percentages are taken from the spendable balance, not the raw one", () => {
  // For native SOL the network fee is reserved, so 100% has to mean the same
  // thing Max does or it would produce a rejected amount.
  const start = sheet.indexOf("function setPercent(percent: number) {");
  const body = sheet.slice(start, sheet.indexOf("function selectToken", start));
  assert.match(body, /available \?\? 0n/);
  assert.match(body, /BigInt\(percent\)/);
});

test("a percentage is written exactly, not through the display formatter", () => {
  // Regression guard. The display formatter rounds to six fraction digits, so
  // 100% of a 0.006051912 NEAR holding was written as 0.006052, which parsed
  // back to 88 base units more than was held and the gate reported
  // "Insufficient balance" against the amount the button had just set.
  const start = sheet.indexOf("function setPercent(percent: number) {");
  const body = sheet.slice(start, sheet.indexOf("function selectToken", start));
  assert.match(body, /formatBaseUnitsExact\(/);
  assert.doesNotMatch(body, /[^x]formatBaseUnits\(/);
});

test("the exact formatter is the only one that writes to the amount input", () => {
  // Any lossy formatter feeding this string is a rounding bug waiting to
  // happen, because the amount is derived by parsing it back.
  const writes = [...sheet.matchAll(/amountInput = ([^;]+);/g)].map((m) =>
    m[1].trim(),
  );
  assert.ok(writes.length > 0, "expected the amount input to be written");
  for (const write of writes) {
    assert.doesNotMatch(
      write,
      /(?<!Exact)formatBaseUnits\(/,
      `a lossy formatter writes to the amount input: ${write}`,
    );
  }
});

test("no token is named in the source picker", () => {
  // "Pay with" must not hardcode a symbol; it renders whatever is held.
  const picker = pickerSection();
  assert.doesNotMatch(picker, /"USDC"/);
  assert.doesNotMatch(picker, /"SOL"/);
  assert.doesNotMatch(picker, /"WNEAR"/);
});

test("selection is keyed by mint, not by a symbol", () => {
  // Symbols are not unique and can change; the mint is the identity.
  assert.match(sheet, /let sourceMint: string = WSOL_MINT/);
  assert.match(sheet, /function selectToken\(mint: string\)/);
  assert.match(sheet, /walletTokens\.find\(\(t\) => t\.mint === sourceMint\)/);
});

test("each option shows its symbol, icon, balance and USD value", () => {
  const picker = pickerSection();
  assert.match(picker, /\{token\.symbol\}/);
  assert.match(picker, /src=\{token\.icon\}/);
  assert.match(picker, /formatTokenBalance\(token\)/);
  assert.match(picker, /formatUsd\(token\.usdValue\)/);
});

test("an empty wallet is stated plainly", () => {
  assert.match(sheet, /No tokens found in this wallet\./);
});

test("the selected token is validated against what the wallet holds", () => {
  // A selection can outlive the balance it was made with.
  assert.match(sheet, /if \(!found\.some\(\(t\) => t\.mint === sourceMint\)\)/);
});

test("tokens are fetched once per wallet, not on every render", () => {
  assert.match(sheet, /tokensOwner === requested && walletTokens\.length > 0/);
  assert.match(sheet, /if \(tokensOwner !== requested\) return;/);
});

test("wNEAR stays the bridge target regardless of the source token", () => {
  assert.match(sheet, /needsSwap = source\.mint !== WNEAR_MINT/);
});

test("the token list survives a reset", () => {
  // Extract just the reset() body so the assertion cannot reach past it.
  const start = sheet.indexOf("function reset() {");
  assert.ok(start > -1, "expected a reset function");
  let depth = 0;
  let end = start;
  for (let i = start; i < sheet.length; i++) {
    if (sheet[i] === "{") depth++;
    else if (sheet[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = sheet.slice(start, end);
  assert.doesNotMatch(body, /walletTokens = \[\]/);
  assert.doesNotMatch(body, /tokensOwner = null/);
  // The list is a property of the wallet, not of one transfer.
  assert.doesNotMatch(body, /walletTokens/);
});

test("the sheet never calls the wrapped token by its wrapped name", () => {
  // The product says NEAR, not wNEAR.
  assert.doesNotMatch(sheet, />wNEAR</);
  assert.doesNotMatch(sheet, /"wNEAR"/);
  assert.match(sheet, /const NEAR_SYMBOL = SWAP_TOKENS\.WNEAR\.symbol/);
});
