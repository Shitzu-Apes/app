import assert from "node:assert/strict";
import test from "node:test";

const { DUST_USD, isDust } = await import("../src/bridge/dust.ts");

// A wallet routinely holds hundreds of accounts it has never spent — airdropped shards,
// swap residue, an account someone else opened. Every one is a real balance and none is
// a decision, so a list ordered honestly by them buries the two or three that matter.

test("zero is always dust", () => {
  assert.equal(isDust({ balance: 0n }), true);
  assert.equal(
    isDust({ balance: 0n, usdValue: 5 }),
    true,
    "even a priced zero",
  );
});

test("a known value under the threshold is dust", () => {
  assert.equal(isDust({ balance: 1n, usdValue: 0 }), true);
  assert.equal(isDust({ balance: 1n, usdValue: DUST_USD / 2 }), true);
  assert.equal(isDust({ balance: 1n, usdValue: DUST_USD - 0.001 }), true);
  assert.equal(
    isDust({ balance: 1n, usdValue: DUST_USD }),
    false,
    "the threshold is not dust",
  );
  assert.equal(isDust({ balance: 1n, usdValue: 10_607 }), false);
});

test("an unpriced balance is never dust", () => {
  // The mistake this area kept making. Not being able to value a token is not being
  // worthless, and hiding a balance because the indexer has never heard of its price is
  // how a token the user holds disappears from their own list.
  assert.equal(isDust({ balance: 1n }), false);
  assert.equal(isDust({ balance: 1n, usdValue: undefined }), false);
  assert.equal(
    isDust({ balance: 5_000_000_000n }),
    false,
    "a real balance, unpriced",
  );
});

test("the balance magnitude is irrelevant; only the value decides", () => {
  // Base units are meaningless across tokens with different decimals, so a fixed
  // number of units is generous for a 6-decimal token and dust for a 9-decimal one.
  // That is exactly why the threshold is in value: the same count of units is dust in
  // one token and a position in another, and the count cannot tell them apart.
  const units = 1_000_000n;
  assert.equal(isDust({ balance: units, usdValue: 0.001 }), true);
  assert.equal(isDust({ balance: units, usdValue: 250 }), false);

  // A far larger count is still dust if it is worth nothing, and a far smaller one is
  // still a position if it is worth something.
  assert.equal(isDust({ balance: 10n ** 30n, usdValue: 0 }), true);
  assert.equal(isDust({ balance: 10n, usdValue: 4.9 }), false);
});
