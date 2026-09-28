import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SHEET =
  "src/lib/components/memecooking/BottomSheet/SolToNearBridgeSheet.svelte";
const src = (f: string) => readFileSync(f, "utf8");

// The wNEAR Omni Bridge route only settles on mainnet. Verified against the
// live APIs: mainnet returns a fee for sol:3ZLekZYq..., testnet answers
// "Passed token is not registered with the near contract bridge".
test("the sheet derives support from the SDK's resolved network", () => {
  assert.match(src(SHEET), /const IS_SUPPORTED = OMNI_NETWORK === "mainnet"/);
});

test("the sheet imports OMNI_NETWORK from the shared bridge module", () => {
  assert.match(
    src(SHEET),
    /import \{ OMNI_NETWORK \} from "\$lib\/bridge\/omni"/,
  );
});

test("an unsupported network shows an explicit message", () => {
  const s = src(SHEET);
  assert.match(s, /\{#if !IS_SUPPORTED\}/);
  assert.match(s, /Not available on testnet/);
});

test("submit is blocked outright on an unsupported network", () => {
  assert.match(
    src(SHEET),
    /function onSubmit\(\) \{\s*\n\s*if \(!IS_SUPPORTED\) return;/,
  );
});

test("no quote is requested on an unsupported network", () => {
  // Otherwise the user sees a real-looking quote for a deposit that can never
  // settle, then fails after signing two transactions.
  assert.match(
    src(SHEET),
    /if \(IS_SUPPORTED && needsSwap && amount !== null && amount > 0n\)/,
  );
});

test("the quote key includes network support so it re-evaluates", () => {
  assert.match(
    src(SHEET),
    /quoteInputs = `\$\{amount \?\? ""\}:\$\{source\.mint\}:\$\{IS_SUPPORTED\}`/,
  );
});

test("the live testnet bridge API rejects the mainnet wNEAR token", async () => {
  // Guards the premise of this whole restriction.
  const url =
    "https://testnet.api.bridge.nearone.org/api/v2/transfer-fee" +
    "?sender=sol:9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM" +
    "&recipient=near:test.testnet" +
    "&token=sol:3ZLekZYq2qkZiSpnSvabjit34tUkjSwD1JFuW9as9wBG";
  const res = await fetch(url);
  const body = await res.text();
  assert.ok(!res.ok || /not registered/i.test(body), body.slice(0, 200));
});

test("the live mainnet bridge API accepts it", async () => {
  const url =
    "https://mainnet.api.bridge.nearone.org/api/v2/transfer-fee" +
    "?sender=sol:9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM" +
    "&recipient=near:test.testnet" +
    "&token=sol:3ZLekZYq2qkZiSpnSvabjit34tUkjSwD1JFuW9as9wBG";
  const fee = await (await fetch(url)).json();
  assert.ok(fee.transferred_token_fee, "expected a mainnet wNEAR token fee");
});
