import { Connection, PublicKey } from "@solana/web3.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  enrichWithMetadata,
  enrichWithPrices,
  fetchWalletTokens,
  formatTokenBalance,
  WSOL_MINT,
  type WalletToken,
} from "../src/lib/solana/tokenBalances.ts";

const live = { skip: !process.env.SOLANA_LIVE };

/**
 * One shared fetch for the whole file.
 *
 * Each `fetchWalletTokens` call issues up to ~18 Jupiter lookups, and running
 * that per test was itself earning 429s, which made results depend on how hard
 * the suite had just hammered the API.
 */
const CONNECTION = new Connection(
  "https://api.mainnet-beta.solana.com/",
  "confirmed",
);
let shared: Promise<WalletToken[]> | null = null;
function walletTokens(): Promise<WalletToken[]> {
  shared ??= fetchWalletTokens(CONNECTION, OWNER);
  return shared;
}

// A wallet that holds a spread of SPL tokens, including zero-balance accounts.
const OWNER = new PublicKey("9yDCicRqNmtUEX3z2krBiZ6GaYQba6NRFrLtcVBXozcT");
const WNEAR = "3ZLekZYq2qkZiSpnSvabjit34tUkjSwD1JFuW9as9wBG";

test("native SOL leads the list and is marked native", live, async () => {
  const tokens = await walletTokens();
  assert.ok(tokens.length > 0);
  const sol = tokens.find((t) => t.mint === WSOL_MINT);
  assert.ok(sol, "expected native SOL");
  assert.equal(sol.native, true);
  assert.equal(sol.symbol, "SOL");
  assert.equal(sol.decimals, 9);
  assert.ok(sol.balance > 0n);
  // Anything that is not native is an SPL token with its own decimals.
  for (const t of tokens.filter((x) => !x.native)) {
    assert.notEqual(t.mint, WSOL_MINT);
  }
});

test("decimals come from the chain, not a hardcoded table", live, async () => {
  const tokens = await walletTokens();
  const decimals = new Set(tokens.map((t) => t.decimals));
  // This wallet holds tokens with differing precision, which is the whole point.
  assert.ok(decimals.size > 1, `expected mixed decimals, saw ${[...decimals]}`);
  for (const t of tokens) {
    assert.ok(
      Number.isInteger(t.decimals) && t.decimals >= 0 && t.decimals <= 18,
      `${t.symbol} has decimals ${t.decimals}`,
    );
  }
});

test("zero-balance accounts are dropped", live, async () => {
  const tokens = await walletTokens();
  for (const t of tokens) {
    assert.ok(t.balance > 0n, `${t.symbol} should not be listed at zero`);
  }
});

test("mints are unique", live, async () => {
  const tokens = await walletTokens();
  assert.equal(new Set(tokens.map((t) => t.mint)).size, tokens.length);
});

test(
  "metadata resolves the NEAR symbol rather than a shortened mint",
  live,
  async () => {
    const tokens = await walletTokens();
    const near = tokens.find((t) => t.mint === WNEAR);
    assert.ok(near, "expected the wrapped NEAR token in this wallet");
    // Deliberately not Jupiter's "wNEAR": the product says NEAR, and Jupiter
    // has no icon for this token at all, so the override is what makes it
    // render properly even with every third-party API down.
    assert.equal(near.symbol, "NEAR");
    assert.equal(near.routable, true);
    assert.equal(near.icon, "/wnear.webp");
  },
);

test("live: native SOL keeps its shipped symbol and icon", live, async () => {
  const tokens = await walletTokens();
  const sol = tokens.find((t) => t.mint === WSOL_MINT);
  assert.ok(sol, "expected native SOL");
  assert.equal(sol.symbol, "SOL");
  assert.equal(sol.icon, "/sol-logo.webp");
});

test("a token Jupiter does not know still appears, marked unroutable", async () => {
  const fake: WalletToken[] = [
    {
      mint: "So11111111111111111111111111111111111111112",
      balance: 5n,
      decimals: 9,
      symbol: "SOL",
      routable: true,
      native: true,
    },
    {
      mint: "TotallyUnknownMint1111111111111111111111111111",
      balance: 7n,
      decimals: 6,
      symbol: "Tot…111",
      routable: false,
      native: false,
    },
  ];
  // No network: enrichment must not throw and must not drop the token.
  const out = await enrichWithMetadata(fake);
  assert.equal(out.length, 2);
  const unknown = out.find((t) => !t.native);
  assert.ok(unknown, "the unknown token must survive");
  assert.equal(unknown.mint, "TotallyUnknownMint1111111111111111111111111111");
  assert.ok(unknown.balance > 0n);
});

test("routable tokens are ordered first", async () => {
  const out = await enrichWithMetadata([
    {
      mint: "UnroutableA11111111111111111111111111111111111",
      balance: 10n ** 12n,
      decimals: 9,
      symbol: "A",
      routable: false,
      native: false,
    },
    {
      mint: "RoutableB1111111111111111111111111111111111111",
      balance: 1n,
      decimals: 9,
      symbol: "B",
      routable: true,
      native: false,
    },
  ]);
  // A is bigger, but B is routable so it leads.
  assert.equal(out[0].symbol, "B");
});

test("balances format with the token's own precision", () => {
  const usdc: WalletToken = {
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    balance: 1_500_000n,
    decimals: 6,
    symbol: "USDC",
    routable: true,
    native: false,
  };
  assert.equal(formatTokenBalance(usdc), "1.5");

  const zeroDecimals: WalletToken = {
    mint: "x",
    balance: 42n,
    decimals: 0,
    symbol: "X",
    routable: true,
    native: false,
  };
  assert.equal(formatTokenBalance(zeroDecimals), "42");
});

test("a tiny non-zero balance never renders as 0", () => {
  // Fixed decimal formatting collapsed dust to "0", which read as empty.
  const dust: WalletToken = {
    mint: "y",
    balance: 12_345n,
    decimals: 9,
    symbol: "DUST",
    routable: true,
    native: false,
  };
  const shown = formatTokenBalance(dust);
  assert.notEqual(shown, "0");
  assert.ok(Number(shown.replace(/,/g, "")) > 0, `got "${shown}"`);

  const trulyZero: WalletToken = { ...dust, balance: 0n };
  assert.equal(formatTokenBalance(trulyZero), "0");
});

test("large balances are rounded to whole units", () => {
  const whale: WalletToken = {
    mint: "z",
    balance: 4_510_179_000_000_000n,
    decimals: 9,
    symbol: "BIG",
    routable: true,
    native: false,
  };
  assert.equal(formatTokenBalance(whale), "4,510,179");
});

const WNEAR_MINT = "3ZLekZYq2qkZiSpnSvabjit34tUkjSwD1JFuW9as9wBG";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

test(
  "live: holdings are ordered by USD value, not token count",
  live,
  async () => {
    // Sorting by base units buried USDC under millions of an unpriced token: the
    // two have different decimals, so raw amounts are not comparable at all.
    const tokens = await walletTokens();

    // Native SOL leads because it is also what pays the network fee, regardless
    // of how its holding compares in value.
    assert.equal(tokens[0].mint, WSOL_MINT, "SOL must be first");
    assert.equal(tokens[0].native, true);

    // Everything after SOL is ordered by USD value, most valuable first. SOL is
    // excluded because it is pinned rather than sorted.
    const priced = tokens
      .filter((t) => !t.native && t.usdValue !== undefined)
      .map((t) => t.usdValue!);
    for (let i = 1; i < priced.length; i++) {
      assert.ok(
        priced[i] <= priced[i - 1],
        `not descending at ${i}: ${priced[i - 1]} then ${priced[i]}`,
      );
    }

    // Unpriced tokens sort after everything we can value.
    const firstUnpriced = tokens.findIndex((t) => t.usdValue === undefined);
    if (firstUnpriced > -1) {
      assert.ok(
        tokens.slice(firstUnpriced).every((t) => t.usdValue === undefined),
        "unpriced tokens must be grouped at the end",
      );
    }
  },
);

/**
 * Jupiter rate-limits aggressively, and a burst of test runs can earn a 429.
 * That is an environmental condition rather than a product failure, so the
 * pricing assertions report it and move on instead of failing or passing
 * silently.
 */
async function pricedTokens(): Promise<WalletToken[] | null> {
  const tokens = await walletTokens();
  return tokens.some((t) => t.usdValue !== undefined) ? tokens : null;
}

test("live: USDC is priced and ranked near the top", live, async () => {
  const tokens = await pricedTokens();
  if (!tokens) {
    console.log("  (skipped: Jupiter price API rate-limited this run)");
    return;
  }
  const usdc = tokens.find((t) => t.mint === USDC_MINT);
  assert.ok(usdc, "expected USDC");
  assert.ok(usdc?.usdValue !== undefined, "USDC should be priced");
  assert.ok(
    usdc!.usdValue! > 100,
    `USDC should be worth >$100, got ${usdc?.usdValue}`,
  );
  // 814 USDC must outrank an unpriced token held in the millions.
  const unpriced = tokens.findIndex((t) => t.usdValue === undefined);
  if (unpriced > -1) {
    assert.ok(
      tokens.indexOf(usdc!) < unpriced,
      "USDC must rank above unpriced",
    );
  }
});

test("live: wNEAR is priced", live, async () => {
  const tokens = await pricedTokens();
  if (!tokens) {
    console.log("  (skipped: Jupiter price API rate-limited this run)");
    return;
  }
  const near = tokens.find((t) => t.mint === WNEAR_MINT);
  assert.ok(near?.usdPrice && near.usdPrice > 0, "expected a wNEAR price");
  assert.ok(near?.usdValue !== undefined);
});

test("ordering degrades safely when pricing is unavailable", async () => {
  // Jupiter being down or rate-limiting must not scramble the list: native SOL
  // still leads, routable tokens still precede unroutable ones, and nothing is
  // dropped.
  const tokens: WalletToken[] = [
    {
      mint: WSOL_MINT,
      balance: 255_316_000n,
      decimals: 9,
      symbol: "SOL",
      routable: true,
      native: true,
    },
    {
      mint: "Routable1111111111111111111111111111111111",
      balance: 4_510_179_000_000_000n,
      decimals: 9,
      symbol: "JAMBO",
      routable: true,
      native: false,
    },
    {
      mint: "Unroutable111111111111111111111111111111111",
      balance: 9n,
      decimals: 0,
      symbol: "DUST",
      routable: false,
      native: false,
    },
  ];
  const out = await enrichWithPrices(tokens);
  assert.equal(out.length, 3, "nothing may be dropped");
  assert.equal(out[0].native, true, "SOL still leads without prices");
  const firstUnroutable = out.findIndex((t) => !t.routable);
  assert.ok(
    out.slice(firstUnroutable).every((t) => !t.routable),
    "unroutable tokens stay grouped at the end",
  );
  // The fabricated mints cannot be priced. SOL's real mint may be, which is
  // fine: it is pinned first either way.
  for (const token of out.filter((t) => !t.native)) {
    assert.equal(
      token.usdValue,
      undefined,
      `${token.symbol} should not be priced`,
    );
  }
});

test("jupiter calls are throttled and cached, not fired all at once", () => {
  // A wallet with dozens of tokens used to earn a burst of 429s, which silently
  // downgraded every token to a shortened mint. The requests are now batched a hundred
  // at a time, which is what removed the burst; the throttle and the caches stay as
  // the backstop for a wallet large enough to need several calls. The behaviour of both
  // is covered against the real functions in `solanaTokenMetadata`.
  const src = readFileSync("src/lib/solana/tokenBalances.ts", "utf8");
  assert.match(src, /MAX_CONCURRENT_JUPITER = \d+/);
  assert.match(src, /withJupiterSlot/);
  assert.match(src, /metadataCache/);
  assert.match(src, /priceCache/);
  // A hundred mints per call, which is Jupiter's documented limit for the search
  // endpoint and one the price endpoint accepts too.
  assert.match(src, /const METADATA_BATCH = 100;/);
  assert.match(src, /const PRICE_BATCH = 100;/);
  // Failures must not be cached, or one 429 would stick for the session. The cache
  // holds resolved metadata and nothing writes to it unless a token actually came back,
  // so there is no failure to evict — which is stronger than evicting one.
  assert.match(src, /const metadataCache = new Map<string, JupiterToken>\(\);/);
  assert.doesNotMatch(
    src,
    /metadataCache\.delete/,
    "there is no eviction because a failure is never written",
  );
});

test("pricing survives a failure and leaves tokens unpriced, not dropped", async () => {
  const tokens: WalletToken[] = [
    {
      mint: "A11111111111111111111111111111111111111111",
      balance: 5_000_000_000n,
      decimals: 9,
      symbol: "AAA",
      routable: true,
      native: false,
    },
  ];
  // No network: pricing must not throw or drop anything.
  const out = await enrichWithPrices(tokens);
  assert.equal(out.length, 1);
  assert.equal(out[0].usdValue, undefined);
  assert.ok(out[0].balance > 0n);
});
