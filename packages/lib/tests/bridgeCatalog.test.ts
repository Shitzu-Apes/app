import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCatalog,
  searchNear,
  suggestTargets,
} from "../src/bridge/catalog.ts";
import type { Registry } from "../src/bridge/rail.ts";

/**
 * The target list has to be universal, not just the eight bridge assets.
 *
 * That means the two aggregators' own indexes, and the ordering has to be by what
 * the user holds — a wallet with one meaningful balance is unusable if a million
 * of a worthless token sorts above it.
 */
const registry: Registry = {
  NEAR: {
    symbol: "NEAR",
    icon: "/wnear.webp",
    decimals: { near: 24, solana: 9 },
    addresses: {
      near: "wrap.near",
      // The real wrapped-NEAR mint, not the wrapped-SOL one. Using So111… here
      // would collide with SOL in Jupiter's list and quietly rename it.
      solana: "3ZLekZYq2qkZiSpnSvabjit34tUkjSwD1JFuW9as9wBG",
    },
  },
  SHITZU: {
    symbol: "SHITZU",
    icon: "/s.webp",
    decimals: { near: 18, solana: 9 },
    addresses: {
      near: "token.0xshitzu.near",
      solana: "AFbJW5rdaGidnF6o8ZqTtkDBpq3fotSBdJN8fGRN3VRS",
    },
  },
};

function withFetch<T>(body: unknown, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
  return run().finally(() => {
    globalThis.fetch = original;
  });
}

const intearList = [
  {
    account_id: "wrap.near",
    metadata: { symbol: "NEAR", decimals: 24 },
    price_usd: "5.2",
    liquidity_usd: 9_000_000,
  },
  {
    account_id: "token.0xshitzu.near",
    metadata: { symbol: "SHITZU", decimals: 18 },
    price_usd: "0.003",
    liquidity_usd: 50_000,
  },
  {
    // Bridged tokens are listed under a 64-hex address form, which is not a NEAR
    // account id and which the aggregator cannot be asked about.
    account_id:
      "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
    metadata: { symbol: "USDC", decimals: 6 },
    price_usd: "1",
    liquidity_usd: 800_000,
  },
  {
    account_id: "deleted.near",
    metadata: { symbol: "GONE", decimals: 18 },
    price_usd: "1",
    deleted: true,
  },
];

const jupiterList = [
  {
    id: "So11111111111111111111111111111111111111112",
    symbol: "SOL",
    decimals: 9,
    icon: "i.png",
  },
  {
    id: "AFbJW5rdaGidnF6o8ZqTtkDBpq3fotSBdJN8fGRN3VRS",
    symbol: "SHITZU",
    decimals: 9,
  },
  { id: "MintX", symbol: "X", decimals: 6 },
];

test("the NEAR catalogue merges the bridge assets with the index", async () => {
  const catalog = await withFetch(intearList, () =>
    buildCatalog(registry, "near"),
  );
  // The bridge's own tokens are always present even though the index omits them,
  // because they are the ones that provably arrive.
  assert.ok(catalog.some((t) => t.tokenId === "wrap.near" && t.bridgeable));
  // And so is everything the aggregator can swap.
  assert.ok(catalog.length >= 2);
});

test("a token listed only as a hex address is not offered", async () => {
  // The aggregator addresses tokens by contract id, so a 64-hex entry would quote
  // as "no route" for every amount — indistinguishable from having no pool.
  const catalog = await withFetch(intearList, () =>
    buildCatalog(registry, "near"),
  );
  assert.equal(
    catalog.some((t) => t.tokenId.startsWith("17208628")),
    false,
  );
});

test("a deleted token is not offered", async () => {
  const catalog = await withFetch(intearList, () =>
    buildCatalog(registry, "near"),
  );
  assert.equal(
    catalog.some((t) => t.tokenId === "deleted.near"),
    false,
  );
});

test("a bridged token appears once, keeping the bridge's identity", async () => {
  const catalog = await withFetch(intearList, () =>
    buildCatalog(registry, "near"),
  );
  const shitzu = catalog.filter((t) => t.tokenId === "token.0xshitzu.near");
  assert.equal(shitzu.length, 1);
  // The indexer's price is kept, since the registry has none.
  assert.equal(shitzu[0].price, 0.003);
  assert.equal(shitzu[0].bridgeable, true);
});

test("held tokens sort above everything, by value", async () => {
  // 1,000 SHITZU at $0.003 is $3; 1 NEAR at $5.20 is $5.20. Ordering by token
  // count would put 1,000 units of a memecoin above 1 of NEAR, which is exactly the
  // case that makes a wallet unusable.
  const catalog = await withFetch(intearList, () =>
    buildCatalog(registry, "near", [
      { address: "token.0xshitzu.near", balance: 1_000n * 10n ** 18n },
    ]),
  );
  const shitzu = catalog.find((t) => t.tokenId === "token.0xshitzu.near");
  assert.equal(shitzu?.heldUsd, 3);
  assert.ok(
    catalog.indexOf(shitzu!) <
      catalog.indexOf(catalog.find((t) => t.tokenId === "wrap.near")!),
    "a held token outranks an unheld one",
  );
});

test("an unpriced holding does not crash the ordering", async () => {
  const catalog = await withFetch(
    [{ ...intearList[1], price_usd: undefined }],
    () =>
      buildCatalog(registry, "near", [
        { address: "token.0xshitzu.near", balance: 1n },
      ]),
  );
  const shitzu = catalog.find((t) => t.tokenId === "token.0xshitzu.near");
  assert.equal(shitzu?.held, 1n);
  // No price means no value, which is different from a value of zero.
  assert.equal(shitzu?.heldUsd, undefined);
});

test("the Solana catalogue merges the bridge assets with Jupiter's list", async () => {
  let priceCalls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL) => {
    if (String(url).includes("price/v3")) {
      priceCalls++;
      return new Response(
        JSON.stringify({
          // Quoted unquoted so the key is the bare mint rather than a mangled
          // property name, which is what made the earlier run read undefined.
          ["So11111111111111111111111111111111111111112"]: { usdPrice: 150 },
        }),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify(jupiterList), { status: 200 });
  }) as typeof fetch;
  try {
    const catalog = await buildCatalog(registry, "solana");
    // The list endpoint carries no prices, so the held and bridge mints are
    // priced directly — otherwise "sort by what you hold" has nothing to sort on.
    assert.ok(priceCalls > 0, "held and bridge mints must be priced");
    const sol = catalog.find((t) => t.symbol === "SOL");
    assert.equal(sol?.price, 150);
    // And the bridge's own Solana token is present, flagged, and not renamed by
    // the collision this fixture used to have.
    const wrappedNear = catalog.find((t) => t.tokenId.startsWith("3ZLek"));
    assert.ok(wrappedNear);
    assert.equal(wrappedNear.symbol, "NEAR");
    assert.equal(wrappedNear.bridgeable, true);
  } finally {
    globalThis.fetch = original;
  }
});

test("a failing index costs the extra tokens, not the bridge's own", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("offline");
  }) as typeof fetch;
  try {
    const catalog = await buildCatalog(registry, "near");
    // An aggregator outage must not empty the picker: these are known locally and
    // are the tokens a bridge can actually deliver.
    assert.ok(catalog.length > 0);
    assert.ok(catalog.every((t) => t.bridgeable));
  } finally {
    globalThis.fetch = original;
  }
});

test("an empty query searches nothing rather than everything", async () => {
  assert.deepEqual(await suggestTargets("near", "   "), []);
  assert.deepEqual(await suggestTargets("solana", ""), []);
});

test("a Solana search falls back to the loaded list when DexScreener misses", async () => {
  // DexScreener is the primary source because it is the only one here that both
  // searches across chains and carries an icon. When it has nothing, filtering
  // what is already loaded still finds a token the catalogue knows.
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL) => {
    if (String(url).includes("dexscreener")) {
      return new Response(JSON.stringify({ pairs: [] }), { status: 200 });
    }
    return new Response(JSON.stringify(jupiterList), { status: 200 });
  }) as typeof fetch;
  try {
    const loaded = await buildCatalog(registry, "solana");
    const found = await suggestTargets("solana", "shitzu", { loaded });
    assert.ok(found.some((t) => t.symbol === "SHITZU"));
  } finally {
    globalThis.fetch = original;
  }
});

test("a NEAR search queries the indexer", async () => {
  const original = globalThis.fetch;
  let url = "";
  globalThis.fetch = (async (u: string | URL) => {
    url = String(u);
    return new Response(JSON.stringify([intearList[0]]), { status: 200 });
  }) as typeof fetch;
  try {
    const found = await searchNear("omgy", "alice.near");
    assert.equal(found.length, 1);
    // The account is passed so the indexer can boost what is already held.
    assert.match(url, /acc=alice\.near/);
    // And reputation is filtered, so a picker is not a wall of spam.
    assert.match(url, /rep=NotFake/);
  } finally {
    globalThis.fetch = original;
  }
});
