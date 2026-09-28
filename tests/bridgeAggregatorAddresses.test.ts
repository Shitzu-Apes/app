import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

process.env.VITE_NETWORK_ID = "mainnet";

const { asTokenAddress } = await import("../src/lib/bridge/tokenAddress.ts");

// An aggregator only understands addresses. A registry *key* reaching one produces a
// request the router cannot answer — `token_in=JLU&token_out=JLU`, a pair of tickers
// where a pair of contracts belongs — which reads as a market with no liquidity rather
// than as the malformed request it is.
//
// The resolver is a pure function in its own module because `routeSearch.ts` reaches
// `fee.ts` and through it `$app`, so the rule could not be tested where it was first
// written.

const registry = {
  SHITZU: {
    symbol: "SHITZU",
    icon: "",
    decimals: { near: 18, solana: 9 },
    addresses: { near: "token.0xshitzu.near", solana: "SHZ" },
  },
  JLU: {
    symbol: "JLU",
    icon: "",
    decimals: { near: 18, solana: 9 },
    addresses: { near: "jlu-1018.meme-cooking.near", solana: "JLU1" },
  },
  // Carried on one chain only, which is the case that must not be guessed at.
  NEARONLY: {
    symbol: "NEARONLY",
    icon: "",
    decimals: { near: 18 },
    addresses: { near: "nearonly.near" },
  },
} as never;

test("a registry key resolves to its contract", () => {
  // The reported failure: SHITZU → JLU on NEAR sent `token_in=JLU&token_out=JLU`.
  assert.equal(
    asTokenAddress(registry, "JLU", "near"),
    "jlu-1018.meme-cooking.near",
  );
  assert.equal(
    asTokenAddress(registry, "SHITZU", "near"),
    "token.0xshitzu.near",
  );
});

test("a key with no address on that chain is left alone rather than guessed at", () => {
  // Guessing an address would be worse than sending what we were given: the request
  // would be well-formed and about the wrong token.
  assert.equal(asTokenAddress(registry, "NEARONLY", "solana"), "NEARONLY");
});

test("the aggregator's rejected prefix is stripped", () => {
  // Documented as valid and answered with an empty route list for every pair, which is
  // indistinguishable from a token with no pool.
  const prefixed = {
    WNEAR: {
      symbol: "NEAR",
      icon: "",
      decimals: { near: 24 },
      addresses: { near: "nep141:wrap.near" },
    },
  } as never;
  assert.equal(asTokenAddress(prefixed, "WNEAR", "near"), "wrap.near");
});

test("nothing at all is an empty string, not the word undefined", () => {
  assert.equal(asTokenAddress(registry, undefined, "near"), "");
  assert.equal(asTokenAddress(registry, null, "near"), "");
  assert.equal(asTokenAddress(registry, "", "near"), "");
});

test("a same-chain swap is asked in the two contracts, not one ticker twice", async () => {
  // The reported failure, and where it actually lived. The search priced the route
  // correctly and put it on screen; the *execution* re-quoted it, and derived the pair
  // from `plan.rail` — which is null for a same-chain conversion, because there is no
  // bridge and so no rail. Both sides fell back to `plan.targetSymbol`, so the router
  // was asked for `token_in=JLU&token_out=JLU`.
  //
  // It reads as a market with no liquidity rather than as the malformed request it is,
  // which is why fixing the quoter's input handling did nothing: the input was already
  // an address. The bug was that there was only one of them.
  const near = readFileSync("src/lib/bridge/executeNear.ts", "utf8");
  const start = near.indexOf("export async function runSameChainSwap(");
  const fn = near.slice(start, near.indexOf("\n}\n", start));
  assert.match(
    fn,
    /railTokenId: sourceTokenId,\s*\n\s*targetTokenId,/,
    "the NEAR leg takes both from its arguments",
  );
  assert.doesNotMatch(
    fn,
    /rail \? rail\.sourceAddress : plan\.targetSymbol/,
    "and no longer derives either from a rail that is null",
  );
  assert.doesNotMatch(
    fn,
    /const target = rail \?/,
    "nor a single `target` used for both sides",
  );
  // The caller passes what it priced with.
  const panel = readFileSync("src/lib/bridge/AnyToAnyPanel.svelte", "utf8");
  const call = panel.slice(
    panel.indexOf("await runSameChainSwap({"),
    panel.indexOf("});", panel.indexOf("await runSameChainSwap({")),
  );
  assert.match(call, /sourceTokenId: sourceAddress!/);
  assert.match(call, /targetTokenId: targetAddress!/);
});

const { amountIsUnusable } = await import("../src/lib/bridge/amount.ts");

test("a fraction of SOL is a real amount, not dust", () => {
  // The whole-token rule rejected USDC -> SOL below one SOL, and SOL has nine decimals
  // and is traded in fractions: 0.5 SOL is about a hundred dollars. That is why
  // USDC -> SOL found nothing while USDC -> anything else worked, and why the same swap
  // outward from SOL worked — the outgoing side was judged against the other token's
  // decimals.
  const SOL = 9;
  assert.equal(amountIsUnusable(10n ** 9n, "solana", SOL), false, "1 SOL");
  assert.equal(
    amountIsUnusable(5n * 10n ** 8n, "solana", SOL),
    false,
    "0.5 SOL",
  );
  assert.equal(amountIsUnusable(10n ** 7n, "solana", SOL), false, "0.01 SOL");
  assert.equal(
    amountIsUnusable(10n ** 6n, "solana", SOL),
    true,
    "0.001 SOL is under the floor",
  );
  // The live quote the report was about: 10 USDC buys about 0.083 SOL, which the old
  // rule threw away.
  assert.equal(amountIsUnusable(82_735_000n, "solana", SOL), false);
  // What the rule is actually for: a route that would display as nothing at all.
  assert.equal(amountIsUnusable(1n, "solana", SOL), true);
  assert.equal(amountIsUnusable(10n ** 4n, "solana", SOL), true, "0.00001 SOL");
  assert.equal(amountIsUnusable(0n, "solana", SOL), true);
});

test("whole units still read correctly on a six-decimal token", () => {
  // The rule has to stay strict enough to keep its original purpose: USDC has six
  // decimals, and a fraction of a cent is not worth a route.
  assert.equal(amountIsUnusable(1_000_000n, "near", 6), false, "1 USDC");
  assert.equal(amountIsUnusable(10_000n, "near", 6), false, "0.01 USDC");
  assert.equal(amountIsUnusable(1_000n, "near", 6), true, "0.001 USDC");
  assert.equal(amountIsUnusable(1n, "near", 6), true, "a single base unit");
});

test("the button applies the same 'too small' rule the search did", () => {
  // They were two expressions of the same idea, and a route the search accepted could
  // still be refused on the button. Fixing the search alone would have left USDC -> SOL
  // showing a route with "Amount too small" under it.
  const gate = readFileSync("src/lib/bridge/convertGate.ts", "utf8");
  assert.match(
    gate,
    /amountIsUnusable\(plan\.receiveAmount, dest, plan\.targetDecimals\)/,
  );
  assert.doesNotMatch(
    gate,
    /isSubUnit\(plan\.receiveAmount/,
    "and no longer judges by whole units",
  );
  // The chain comes in as an argument rather than being assumed: the same amount means
  // different things on different chains.
  assert.match(
    gate,
    /dest: Network;/,
    "the gate is told which chain it is judging",
  );
  const panel = readFileSync("src/lib/bridge/AnyToAnyPanel.svelte", "utf8");
  assert.match(
    panel,
    /destConnected: Boolean\(recipientAddress\),\s*\n\s*dest,/,
  );
});
