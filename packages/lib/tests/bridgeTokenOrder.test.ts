import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Object key order is the token picker's display order: TOKEN_ENTRIES is
// Object.entries(TOKENS) and the page renders it directly. Putting a token in
// the wrong slot is invisible to every other test, so the intended order is
// pinned here.

const TOKENS_TS = "src/bridge/tokens.ts";
const src = readFileSync(TOKENS_TS, "utf8");

/** Top-level keys of the TOKENS literal, in declaration order. */
function tokenOrder(): string[] {
  const body = src.slice(
    src.indexOf("export const TOKENS = {"),
    src.indexOf("} as const satisfies"),
  );
  return [...body.matchAll(/^ {2}([A-Z0-9_]+): \{$/gm)].map((m) => m[1]);
}

function balanceOrder(): string[] {
  const body = src.slice(
    src.indexOf("export const balances$"),
    src.indexOf("async function fetchNearBalance"),
  );
  return [...body.matchAll(/^ {2}([A-Z0-9_]+): writable/gm)].map((m) => m[1]);
}

test("OMGY sits below SHITZU, not above it", () => {
  // It was added between NEAR and SHITZU, which put it second in the picker
  // instead of below SHITZU where it belongs.
  const order = tokenOrder();
  const shitzu = order.indexOf("SHITZU");
  const omgy = order.indexOf("OMGY");
  assert.ok(shitzu > -1 && omgy > -1, "both tokens must be registered");
  assert.equal(
    omgy,
    shitzu + 1,
    `expected OMGY directly below SHITZU, got ${order.join(", ")}`,
  );
});

test("the balances store is declared in the same order as the token list", () => {
  // balances$ is keyed independently of TOKENS, so the two lists drift apart
  // silently. It only has to cover every key to typecheck, so the ordering is
  // worth asserting separately.
  assert.deepEqual(balanceOrder(), tokenOrder());
});

test("every token has a balance slot and vice versa", () => {
  assert.deepEqual(
    tokenOrder().filter((k) => !balanceOrder().includes(k)),
    [],
    "tokens with no balance slot",
  );
  assert.deepEqual(
    balanceOrder().filter((k) => !tokenOrder().includes(k)),
    [],
    "balance slots with no token",
  );
});
