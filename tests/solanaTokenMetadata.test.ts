import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

process.env.VITE_NETWORK_ID = "mainnet";

const { enrichWithMetadata } = await import(
  "../src/lib/solana/tokenBalances.ts"
);

// Jupiter's search endpoint takes comma-separated mints, up to 100 in a query. It used
// to be asked for one mint at a time, so a wallet holding sixty tokens cost sixty
// requests against a public endpoint that rate-limits — and the symptom was tokens
// silently degrading to shortened mints with no price, which reads as the app being
// broken rather than as a rate limit.

const originalFetch = globalThis.fetch;
test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

/** A Jupiter answer for the requested mints, minus any listed in `missing`. */
function jupiter(ids: string[], missing: string[] = []) {
  return ids
    .filter((id) => !missing.includes(id))
    .map((id) => ({
      id,
      symbol: `SYM_${id}`,
      name: `Name ${id}`,
      decimals: 6,
      icon: `icon-${id}.png`,
    }));
}

const held = (mints: string[]) =>
  mints.map((mint) => ({
    mint,
    balance: 1_000_000n,
    decimals: 6,
    symbol: mint.slice(0, 4),
    native: false,
  }));

/** Records every search call, and answers with a real Jupiter-shaped body. */
function stubSearch(missing: string[] = []) {
  const calls: string[][] = [];
  globalThis.fetch = (async (url: unknown) => {
    const query = new URL(String(url)).searchParams.get("query") ?? "";
    const ids = query.split(",").filter(Boolean);
    calls.push(ids);
    return new Response(JSON.stringify(jupiter(ids, missing)), { status: 200 });
  }) as typeof fetch;
  return calls;
}

test("a wallet that fits in one call asks the router once", async () => {
  // Sixty held tokens was sixty requests before this.
  const mints = Array.from({ length: 60 }, (_, i) => `mint${i}`);
  const calls = stubSearch();
  await enrichWithMetadata(held(mints));
  assert.equal(calls.length, 1, "one request for sixty tokens");
  assert.equal(calls[0]?.length, 60, "and it carried all sixty mints");
});

test("native SOL is not asked about", async () => {
  const calls = stubSearch();
  await enrichWithMetadata([
    {
      mint: "So11111111111111111111111111111111111111112",
      balance: 5n,
      decimals: 9,
      symbol: "SOL",
      native: true,
    },
  ]);
  assert.equal(calls.length, 0, "it needs nothing from anyone");
});

test("a large wallet is chunked, and nothing is lost or asked about twice", async () => {
  const mints = Array.from({ length: 250 }, (_, i) => `big${i}`);
  const calls = stubSearch();
  const tokens = await enrichWithMetadata(held(mints));
  assert.deepEqual(
    calls.map((c) => c.length),
    [100, 100, 50],
  );
  const asked = calls.flat();
  assert.equal(asked.length, 250, "every mint is asked about once");
  assert.equal(new Set(asked).size, 250, "and none twice");
  for (const token of tokens) {
    assert.ok(
      token.symbol.startsWith("SYM_"),
      `a token was left unlabelled: ${token.mint}`,
    );
  }
});

test("a mint Jupiter does not know keeps its own symbol", async () => {
  // Verified live: four mints in, three out, the unknown one absent rather than null.
  const calls = stubSearch(["ghost"]);
  const tokens = await enrichWithMetadata(
    held(["one", "ghost", "two"]).map((t) =>
      t.mint === "ghost" ? { ...t, symbol: "GHOST" } : t,
    ),
  );
  assert.equal(calls[0]?.length, 3, "all three are still asked about");
  const byMint = new Map(tokens.map((t) => [t.mint, t.symbol]));
  assert.equal(byMint.get("one"), "SYM_one");
  assert.equal(byMint.get("two"), "SYM_two");
  assert.equal(byMint.get("ghost"), "GHOST", "the missing one is untouched");
});

test("a gap in the middle does not shift every later token's symbol", async () => {
  // The reason results are matched by id. Positional matching walks off the end as
  // soon as one mint is missing, and hands every later token the *next* token's symbol
  // — a picker full of nearly-right tickers rather than anything that visibly fails.
  const calls = stubSearch(["gap"]);
  const tokens = await enrichWithMetadata(
    held(["ga", "gap", "gb", "gc"]).map((t) =>
      t.mint === "gap" ? { ...t, symbol: "GAP" } : t,
    ),
  );
  const byMint = new Map(tokens.map((t) => [t.mint, t.symbol]));
  assert.equal(byMint.get("ga"), "SYM_ga");
  assert.equal(byMint.get("gap"), "GAP", "untouched");
  assert.equal(
    byMint.get("gb"),
    "SYM_gb",
    "not gc, which is what position would give",
  );
  assert.equal(byMint.get("gc"), "SYM_gc");
});

test("a rate limit is waited out once rather than answered with shortened mints", async () => {
  let attempts = 0;
  globalThis.fetch = (async (url: unknown) => {
    const query = new URL(String(url)).searchParams.get("query") ?? "";
    attempts++;
    if (attempts === 1) return new Response("", { status: 429 });
    return new Response(JSON.stringify(jupiter(query.split(","))), {
      status: 200,
    });
  }) as typeof fetch;
  const tokens = await enrichWithMetadata(held(["rl"]));
  assert.equal(attempts, 2, "one retry");
  assert.equal(
    tokens.find((t) => t.mint === "rl")?.symbol,
    "SYM_rl",
    "and the metadata still lands",
  );
});

test("an outright failure leaves the list usable rather than dropping tokens", async () => {
  globalThis.fetch = (async () =>
    new Response("", { status: 500 })) as typeof fetch;
  const tokens = await enrichWithMetadata(held(["deadA", "deadB"]));
  assert.equal(
    tokens.length,
    2,
    "a shortened mint beats a token that vanished",
  );
  assert.equal(
    tokens.find((t) => t.mint === "deadA")?.symbol,
    "dead",
    "and it keeps what it had",
  );
});

test("a second read of the same wallet asks for nothing", async () => {
  const calls = stubSearch();
  const mints = ["cacheA", "cacheB"];
  await enrichWithMetadata(held(mints));
  assert.equal(calls.length, 1);
  await enrichWithMetadata(held(mints));
  assert.equal(calls.length, 1, "the second read is served from the cache");
});

test("every test's mints are its own, because the cache is page-lifetime", () => {
  // This file failed twice for this reason rather than for a real one: the cache is
  // module-level and outlives each test, so two tests sharing a mint name silently
  // shared an answer and the second one asserted nothing. A repeated mint name in a
  // test file is a bug in the test, so it is worth being able to see it.
  const source = readFileSync("tests/solanaTokenMetadata.test.ts", "utf8");
  const mints = [...source.matchAll(/held\(\[(.*?)\]/g)]
    .flatMap((m) => m[1].split(",").map((s) => s.trim().replace(/"/g, "")))
    .filter(Boolean);
  const counts = new Map<string, number>();
  for (const mint of mints) {
    counts.set(mint, (counts.get(mint) ?? 0) + 1);
  }
  for (const [mint, n] of counts) {
    assert.equal(
      n,
      1,
      `"${mint}" is used by ${n} tests; the cache would serve them both`,
    );
  }
});
