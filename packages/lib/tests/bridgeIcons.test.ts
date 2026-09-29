import assert from "node:assert/strict";
import test from "node:test";

import { bestPerToken, type DexPair } from "../src/bridge/dexscreener.ts";

// A token's artwork comes from its deepest pool, not from whichever pool the venue
// happened to list first. On NEAR that handed USDC the logo of the Rhea pool it trades
// in — a DEX's icon on a token, which is not a near-miss but a confident wrong answer,
// and there is no way to tell it from a right one at a glance.

/**
 * One pool. The token is the first argument and the *pool* is separate, because the
 * ranking is per token across its pools — two pools of one token are what has to
 * collapse, and two pools of two tokens is just two tokens.
 */
const pair = (
  address: string,
  liquidity: number,
  imageUrl: string | undefined,
  venue = "rhea",
): DexPair =>
  ({
    chainId: "near",
    dexId: venue,
    url: `https://dexscreener.com/near/${address}-${venue}`,
    pairAddress: `${address}-${venue}`,
    baseToken: { address, name: "T", symbol: "T" },
    quoteToken: { address: "wrap.near", name: "wNEAR", symbol: "wNEAR" },
    liquidity: { usd: liquidity },
    info: imageUrl ? { imageUrl } : undefined,
  }) as unknown as DexPair;

const pool = (
  address: string,
  liquidity: number,
  imageUrl: string | undefined,
  venue: string,
) => pair(address, liquidity, imageUrl, venue);

test("the deepest pool's artwork wins, not the first pool's", () => {
  const hits = bestPerToken(
    [
      pool("TKN", 1_000, "https://img/shallow.png", "sundae"),
      pool("TKN", 900_000, "https://img/deep.png", "rhea"),
    ],
    "near",
  );
  assert.equal(hits.length, 1, "one token, one row");
  assert.equal(hits[0]?.icon, "https://img/deep.png");
});

test("a venue's own logo is never preferred over the token's", () => {
  // What actually happened to USDC: the Rhea pool was listed first and carried the
  // venue's image, and the first-pair rule took it at face value.
  const rhea = pair(
    "usdc.tether-token.near",
    5_000,
    "https://img/rhea-logo.png",
  );
  const real = pair("usdc.tether-token.near", 500_000, "https://img/usdc.png");
  const hits = bestPerToken([rhea, real], "near");
  assert.equal(
    hits[0]?.icon,
    "https://img/usdc.png",
    "the deeper pool, and the token's own artwork",
  );
});

test("a token whose deepest pool has no artwork still gets an icon", () => {
  // The regression: ranking first and taking whatever the top hit has leaves a token
  // blank whenever its deepest pool has none, and collapsing a token's pools to one
  // hit means a shallower pool's perfectly good artwork is never looked at. That left
  // USDC and JLU blank on the receive side while the spend side showed them.
  const deepestNoArtwork = [
    pool("TKN", 900_000, undefined, "rhea"),
    pool("TKN", 10_000, "https://img/ok.png", "sundae"),
  ];
  // So the rule is: walk the pools deepest-first and take the first with artwork.
  const icon = [...deepestNoArtwork]
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))
    .find((p) => p.info?.imageUrl)?.info?.imageUrl;
  assert.equal(icon, "https://img/ok.png");
});

test("a venue's logo is still skipped, because the walk is deepest-first", () => {
  // The fix for the shallow venue pool has to survive the fix for the blank token.
  const pools = [
    pool("usdc.tether-token.near", 5_000, "https://img/rhea-logo.png", "rhea"),
    pool("usdc.tether-token.near", 500_000, "https://img/usdc.png", "sundae"),
  ];
  const icon = [...pools]
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))
    .find((p) => p.info?.imageUrl)?.info?.imageUrl;
  assert.equal(icon, "https://img/usdc.png");
});

test("a token with no pools is not an icon", () => {
  assert.deepEqual(bestPerToken([], "near"), []);
});
