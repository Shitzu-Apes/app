import assert from "node:assert/strict";
import test from "node:test";

import { rebaseAmount } from "../src/bridge/amount.ts";
import { netAfterFee } from "../src/bridge/fee.ts";

/** What the bridge does crossing from NEAR to Solana: 18 decimals down to 9. */
const toSolana = (value: bigint) => rebaseAmount(value, 18, 9);
const identity = (value: bigint) => value;

test("an amount above the fee leaves the remainder", () => {
  assert.equal(netAfterFee(1_000n, 100n, identity), 900n);
});

test("an amount equal to the fee cannot arrive", () => {
  // The fee is taken out of the amount, so at or below it nothing is left. This
  // is what makes small transfers impossible, because the fee is near-flat
  // rather than proportional.
  assert.equal(netAfterFee(100n, 100n, identity), null);
  assert.equal(netAfterFee(99n, 100n, identity), null);
});

test("a remainder that truncates to nothing on arrival is a dead transfer", () => {
  // Half a base unit of an 18-decimal token is a real amount worth bridging, but
  // arriving on a 9-decimal chain it rounds away entirely. Offering it as a
  // route would promise a balance that cannot exist.
  assert.equal(netAfterFee(1_500_000_000n, 0n, toSolana), 1n);
  assert.equal(netAfterFee(999_999_999n, 0n, toSolana), null);
});

test("the fee comes off before the re-basing, never after", () => {
  // 2e9 minus 1e9 leaves 1e9, which is one base unit on Solana. Subtracting
  // after re-basing instead would take the 1e9 out of a 2 that had already been
  // scaled down, and lose the whole amount.
  assert.equal(netAfterFee(2_000_000_000n, 1_000_000_000n, toSolana), 1n);
});

test("a zero amount is not a route", () => {
  assert.equal(netAfterFee(0n, 0n, identity), null);
});
