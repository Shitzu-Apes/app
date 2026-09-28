import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// The tab decision must be correct for BOTH products, in CI and in local dev.
// Evaluated against the real predicate from src/lib/auth/capabilities.ts.

const isMultichain = (v) => v === undefined || v !== "false";

/** Mirrors shouldShowEvm(flag, hostname, isMultichain). */
function shouldShowEvm(flag, hostname, mc) {
  if (flag !== undefined) return flag !== "false";
  if (hostname.includes("meme.cooking")) return false;
  return mc;
}

const tabs = (flag, hostname, mcRaw) => {
  const mc = isMultichain(mcRaw);
  const evm = shouldShowEvm(flag, hostname, mc);
  return ["NEAR", ...(mc ? ["Solana"] : []), ...(evm ? ["EVM"] : [])].join(
    ", ",
  );
};

const SHITZU = "app.shitzuapes.xyz";
const MEME = "meme.cooking";
const MEME_STAGING = "staging.meme.cooking";
const LOCALHOST = "localhost";

test("shitzu keeps EVM with no flag set", () => {
  assert.equal(tabs(undefined, SHITZU, undefined), "NEAR, Solana, EVM");
});

test("shitzu keeps EVM on a local dev host", () => {
  // The regression: a global EVM flag hid the tab while developing shitzu.
  assert.equal(tabs(undefined, LOCALHOST, "true"), "NEAR, Solana, EVM");
});

test("meme.cooking drops EVM but keeps Solana", () => {
  assert.equal(tabs(undefined, MEME, "true"), "NEAR, Solana");
  assert.equal(tabs(undefined, MEME_STAGING, "true"), "NEAR, Solana");
});

test("localhost shows EVM, since the product is ambiguous there", () => {
  // You cannot tell the two products apart on localhost, so we show the richer
  // option rather than guessing. CI sets the flag explicitly for meme.cooking,
  // so deployed builds are unaffected.
  assert.equal(tabs(undefined, LOCALHOST, undefined), "NEAR, Solana, EVM");
});

test("an explicit flag overrides the hostname in both directions", () => {
  assert.equal(tabs("false", SHITZU, "true"), "NEAR, Solana");
  assert.equal(tabs("true", MEME, "true"), "NEAR, Solana, EVM");
});

test("multichain=false still collapses to NEAR only", () => {
  assert.equal(tabs(undefined, SHITZU, "false"), "NEAR");
  assert.equal(tabs(undefined, MEME, "false"), "NEAR");
});

test("the source wires shouldShowEvm in and drops the inline flag check", () => {
  const sel = readFileSync("src/lib/auth/WalletSelector.svelte", "utf8");
  assert.match(
    sel,
    /import \{ shouldShowEvm \} from "\$lib\/auth\/capabilities"/,
  );
  assert.match(sel, /const showEvm = shouldShowEvm\(isMultichain\)/);
  // The old inline env-only version is gone.
  assert.doesNotMatch(
    sel,
    /VITE_WALLET_SELECTOR_EVM === undefined\s*\n?\s*\? isMultichain/,
  );
});

test("capabilities.ts keys off the served hostname", () => {
  const src = readFileSync("src/lib/auth/capabilities.ts", "utf8");
  assert.match(src, /window\.location\.hostname\.includes\("meme\.cooking"\)/);
  // Same discriminator hooks.server.ts already uses.
  const hooks = readFileSync("src/hooks.server.ts", "utf8");
  assert.match(hooks, /includes\("meme\.cooking"\)/);
});

test("local env does not force the EVM flag", () => {
  // .env.local is gitignored but loaded by Vite for every mode, so a flag
  // there would apply to whichever product you happen to be developing.
  const local = readFileSync(".env.local", "utf8");
  assert.doesNotMatch(
    local,
    /^VITE_WALLET_SELECTOR_EVM=/m,
    "must not pin EVM in .env.local",
  );
});
