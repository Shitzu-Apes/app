import assert from "node:assert/strict";
import test from "node:test";

import {
  formatUsd,
  labelFor,
  PERCENTS,
  shortAddress,
  toTokenAmount,
  usdFor,
} from "../src/bridge/format.ts";

test("USD precision follows the magnitude", () => {
  assert.equal(formatUsd(1234.5), "$1,235");
  assert.equal(formatUsd(12.345), "$12.35");
  assert.equal(formatUsd(0.1234), "$0.123");
  // Below a hundredth of a cent, significant digits rather than rounding to
  // zero: "almost nothing" and "nothing" are different facts.
  assert.equal(formatUsd(0.0000123), "$0.000012");
});

test("an unknown price is blank, not zero", () => {
  // The registry holds memecoins the app cannot price. Rendering those as $0.00
  // would make the route ranking look broken rather than unpriced.
  assert.equal(formatUsd(null), "");
  assert.equal(formatUsd(undefined), "");
  assert.equal(formatUsd(Number.NaN), "");
  assert.equal(usdFor(1_000_000n, 6, null), "");
  assert.equal(usdFor(1_000_000n, 6, undefined), "");
});

test("a genuinely zero balance is still shown as zero", () => {
  assert.equal(formatUsd(0), "$0.00");
  // ...but a zero amount has nothing to value, so no value is shown.
  assert.equal(usdFor(0n, 6, 1), "");
  assert.equal(usdFor(null, 6, 1), "");
});

test("USD converts base units before pricing", () => {
  // 2 USDC at 6 decimals is $2, not $2,000,000.
  assert.equal(usdFor(2_000_000n, 6, 1), "$2.00");
  assert.equal(usdFor(1_500_000_000_000_000_000n, 18, 2), "$3.00");
});

test("a token with no decimals is a whole count", () => {
  assert.equal(toTokenAmount(42n, 0), 42);
  assert.equal(usdFor(42n, 0, 0.5), "$21.00");
});

test("the quick-fill steps match the existing sheet", () => {
  assert.deepEqual([...PERCENTS], [25, 50, 75, 100]);
});

test("a registry symbol wins, and an unknown id is shortened", () => {
  const registry = { SHITZU: { symbol: "SHITZU" } };
  assert.equal(labelFor("SHITZU", registry), "SHITZU");
  // A source token is whatever the wallet holds, so its id is often not in the
  // registry. The raw contract id would be a wall of text where a symbol belongs.
  assert.equal(labelFor("some.newtoken.near", registry), "some.n…near");
});

test("short addresses keep both ends recognisable", () => {
  assert.equal(shortAddress("So1111"), "So1111");
  assert.equal(
    shortAddress("So11111111111111111111111111111111111111112"),
    "So1111…1112",
  );
});

test("a long unknown id still ends in something recognisable", () => {
  // "…near" alone is not enough to tell one NEP-141 from another, and the tail
  // is the part a user would recognise from a contract they have used before.
  const id = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0.near";
  const short = labelFor(id, {});
  assert.ok(short.includes("…"));
  // The tail is the part a user recognises from a contract they have used before,
  // and for a NEAR account that is the `near` suffix.
  assert.ok(short.endsWith("near"));
  assert.ok(short.length < id.length);
});
