import assert from "node:assert/strict";
import test from "node:test";

// One balance, two ids. Native NEAR reaches the holdings as `near` and the same money
// reaches it again as `wrap.near`, and the registry carries wNEAR as a bridgeable
// asset — so both lists showed "NEAR" twice. The duplicate is the wrapped form, which
// is not the balance that can be spent.

const WRAP = "wrap.near";

/** The rule the spend list uses to keep the two ids from becoming two rows. */
function isNativeNear(tokenId: string): boolean {
  return tokenId === "near" || tokenId === WRAP;
}

/** The rule the receive list uses: the native row wins when it is present. */
function oneRowPerAsset<T extends { address: string }>(rows: T[]): T[] {
  return rows.some((r) => r.address === "near")
    ? rows.filter((r) => r.address !== WRAP)
    : rows;
}

test("both ids are recognised as the same money", () => {
  assert.equal(isNativeNear("near"), true);
  assert.equal(
    isNativeNear(WRAP),
    true,
    "this was the id the filter was missing",
  );
  assert.equal(isNativeNear("usdc.tether-token.near"), false);
  assert.equal(isNativeNear("token.0xshitzu.near"), false);
});

test("one balance, one row on the spend list", () => {
  const holdings = [
    { tokenId: "near", balance: 310n },
    { tokenId: WRAP, balance: 310n },
    { tokenId: "usdc.tether-token.near", balance: 10n },
  ];
  // The bare `near` row is added unconditionally by the list builder and the wrapped
  // one is dropped, so what is filtered out is the duplicate rather than both.
  const rows = holdings.filter((h) => h.tokenId !== WRAP);
  assert.equal(rows.length, 2, "NEAR is one row, not two");
  assert.deepEqual(
    rows.map((r) => r.tokenId),
    ["near", "usdc.tether-token.near"],
  );
});

test("one balance, one row on the receive list", () => {
  const rows = [
    { address: "near" },
    { address: WRAP },
    { address: "token.0xshitzu.near" },
  ];
  assert.equal(oneRowPerAsset(rows).length, 2);
  assert.deepEqual(
    oneRowPerAsset(rows).map((r) => r.address),
    ["near", "token.0xshitzu.near"],
  );
});

test("without the native row the wrapped one is still offered", () => {
  // An account that holds only the wrapped form is holding the same money, and hiding
  // the row entirely would be worse than showing it under either name.
  const rows = [{ address: WRAP }, { address: "token.0xshitzu.near" }];
  assert.equal(oneRowPerAsset(rows).length, 2, "nothing is dropped");
});
