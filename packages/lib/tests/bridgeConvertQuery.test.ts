import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  readConvertQuery,
  resolveTarget,
  type ConvertQuery,
} from "../src/bridge/convertQuery.ts";
import { searchTokens, iconsFor } from "../src/bridge/dexscreener.ts";
import type { RoutePlan } from "../src/bridge/search.ts";
import { costSummary } from "../src/bridge/steps.ts";

// A conversion is four things. Being able to hand someone the exact form you were
// looking at is worth a lot in a support link, so all four live in the URL.

test("the default is a cross-chain conversion, near or sol", () => {
  const fromEmpty = readConvertQuery("");
  assert.equal(fromEmpty.from, "solana");
  assert.equal(fromEmpty.to, "near");
  // Whatever the source, the destination defaults to the other chain, because
  // same-chain is the deliberate exception rather than the default case.
  assert.equal(readConvertQuery("?from=near").to, "solana");
});

test("both ends round-trip through the URL", () => {
  const query: ConvertQuery = { from: "near", to: "solana" };
  const read = readConvertQuery(`?from=near&to=solana`);
  assert.equal(read.from, query.from);
  assert.equal(read.to, query.to);
});

test("same-chain is expressible, which it has to be", () => {
  // OMGY exists on one chain only, so a same-chain conversion is the only way to
  // buy it. A URL that could not express it would be a link that does not work.
  const read = readConvertQuery("?from=near&to=near");
  assert.equal(read.from, "near");
  assert.equal(read.to, "near");
});

test("the target round-trips and survives characters that need encoding", () => {
  const read = readConvertQuery("?t=token.0xshitzu.near");
  assert.equal(read.target, "token.0xshitzu.near");
  // A contract id can carry characters that would otherwise split the query.
  assert.equal(
    readConvertQuery("?from=near&to=near&t=a.b%26c.near").target,
    "a.b&c.near",
  );
});

test("a chain that is not one of ours falls back rather than throwing", () => {
  // A hand-edited or stale link must not be able to put the form into a state it
  // cannot render.
  const read = readConvertQuery("?from=base&to=ethereum");
  assert.equal(read.from, "solana");
  assert.equal(read.to, "near");
});

/** One row of the catalogue, as the picker holds it. */
function catalogToken(address: string, symbol: string) {
  return {
    tokenId: address,
    symbol,
    icon: "",
    address,
    decimals: 18,
    bridgeable: false,
    origin: "aggregator" as const,
  };
}

test("a linked target resolves by exact address, catalogue first", async () => {
  const a = catalogToken("a.near", "A");
  const b = catalogToken("b.near", "B");

  let asked = 0;
  const inCatalog = await resolveTarget("a.near", {
    loaded: [a],
    lookup: async () => {
      asked++;
      return [];
    },
  });
  assert.equal(inCatalog?.tokenId, "a.near");
  assert.equal(asked, 0, "a row already in hand costs no request");

  const found = await resolveTarget("b.near", {
    loaded: [],
    lookup: async () => [a, b],
  });
  assert.equal(found?.tokenId, "b.near");
});

test("a linked target is the exact address, never the first search hit", async () => {
  // A search for an address can return other tokens besides the one asked about —
  // DexScreener matches substrings — and taking the first hit would swap the user's
  // target for a different token, which is worse than not restoring it at all.
  const a = catalogToken("a.near", "A");
  const b = catalogToken("b.near", "B");
  const miss = await resolveTarget("c.near", {
    loaded: [],
    lookup: async () => [a, b],
  });
  assert.equal(miss, null);

  // And a failed search is a missing row, not a thrown form: the caller falls back
  // to the catalogue's own first row, exactly as it did before.
  const failed = await resolveTarget("d.near", {
    loaded: [],
    lookup: async () => {
      throw new Error("offline");
    },
  });
  assert.equal(failed, null);
});

test("the amount is never carried in the URL", () => {
  // It is the one field where a stale value is dangerous: a shared link could
  // otherwise arrive pre-filled and ready to submit for an amount the sender
  // never chose.
  const read = readConvertQuery("?from=near&to=solana&amount=1000000");
  assert.equal("amount" in read, false);
});

test("DexScreener results are filtered to the chain asked about", () => {
  // A search matches names and symbols, so most hits are for other chains. A
  // token offered from the wrong chain could not be quoted at all.
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        pairs: [
          { chainId: "near", baseToken: { address: "a.near", symbol: "A" } },
          { chainId: "solana", baseToken: { address: "B", symbol: "B" } },
        ],
      }),
      { status: 200 },
    )) as typeof fetch;
  return searchTokens("near", "a")
    .then((hits) => {
      assert.deepEqual(
        hits.map((h) => h.tokenId),
        ["a.near"],
      );
    })
    .finally(() => {
      globalThis.fetch = original;
    });
});

test("a token with several pools keeps the deepest one", () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        pairs: [
          {
            chainId: "near",
            baseToken: { address: "a.near", symbol: "A" },
            liquidity: { usd: 10 },
            info: { imageUrl: "small.png" },
          },
          {
            chainId: "near",
            baseToken: { address: "a.near", symbol: "A" },
            liquidity: { usd: 5000 },
            info: { imageUrl: "big.png" },
          },
        ],
      }),
      { status: 200 },
    )) as typeof fetch;
  return searchTokens("near", "a")
    .then((hits) => {
      assert.equal(hits.length, 1, "one entry per token, not per pool");
      // The deepest pool is the one a swap would use, so it is the one worth
      // showing an icon and a price for.
      assert.equal(hits[0].icon, "big.png");
      assert.equal(hits[0].liquidityUsd, 5000);
    })
    .finally(() => {
      globalThis.fetch = original;
    });
});

test("a token with no decimals still gets a usable one", () => {
  // 18 is the NEP-141/ERC-20 default and the amount is parsed against it.
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        pairs: [{ chainId: "near", baseToken: { address: "a.near" } }],
      }),
      { status: 200 },
    )) as typeof fetch;
  return searchTokens("near", "a")
    .then((hits) => {
      assert.equal(hits[0].decimals, 18);
    })
    .finally(() => {
      globalThis.fetch = original;
    });
});

test("a DexScreener outage costs icons, not the picker", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("offline");
  }) as typeof fetch;
  try {
    assert.deepEqual(await searchTokens("near", "shitzu"), []);
    assert.equal((await iconsFor("near", ["a.near"])).size, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test("an empty query searches nothing rather than everything", async () => {
  assert.deepEqual(await searchTokens("near", "  "), []);
});

test("an unknown chain has no DexScreener slug and is skipped", async () => {
  // EVM is not a conversion chain, so it has no slug and must not be searched as
  // though it did.
  assert.equal((await iconsFor("base", ["0xabc"])).size, 0);
});

function plan(over: Partial<RoutePlan> = {}): RoutePlan {
  return {
    kind: "bridge",
    rail: {
      tokenId: "SHITZU",
      symbol: "SHITZU",
      icon: "/s.webp",
      sourceAddress: "token.0xshitzu.near",
      destAddress: "AFbJW5",
      sourceDecimals: 18,
      destDecimals: 9,
    },
    sourceSymbol: "USDT",
    targetSymbol: "SHITZU",
    targetDecimals: 9,
    sourceSwap: null,
    targetSwap: null,
    bridgedAmount: 1_000n,
    tokenFee: 2_000_000_000_000n,
    nativeFee: 82_439n,
    usdFee: 0.01,
    arrivedAmount: 998n,
    receiveAmount: 998n,
    receiveEstimated: 998n,
    ...over,
  };
}

test("the cost reads as two charges and a total", () => {
  // `−0.001936 NEAR + 0.000082 SOL + ($0.010)` read as three things being added,
  // with the fee arriving positive because the API returns it positive. Now two
  // amounts, a total, and nothing else: the row is labelled "Bridge fee", so
  // spelling out where each half is taken from only made it longer.
  const cost = costSummary(plan(), "solana");
  assert.equal(cost, "0.000002 SHITZU + 0.000082 SOL  ≈ $0.010");
  // The sub-dollar band keeps three decimals, so a cent reads as $0.010.
  assert.match(cost, /≈ \$0\.010$/);
  // The dollar figure is the total, not a third line item.
  assert.equal((cost.match(/≈/g) ?? []).length, 1);
});

test("the cost states no provenance for either charge", () => {
  // "of the amount" and "gas" were the two complaints. The symbols already say
  // which coin each half is denominated in, and the label says what it is for.
  const cost = costSummary(plan(), "solana");
  assert.doesNotMatch(cost, /of the amount/);
  assert.doesNotMatch(cost, /gas/);
});

test("a missing token fee omits that half rather than showing zero", () => {
  const cost = costSummary(plan({ tokenFee: 0n }), "solana");
  assert.doesNotMatch(cost, /SHITZU/);
  assert.match(cost, /0\.000082 SOL/);
});

test("a same-chain swap reports no bridge cost at all", () => {
  assert.equal(costSummary(plan({ kind: "swap", rail: null }), "near"), "");
});

// The list the picker shows before anyone types, and what it costs to show it.

test("the NEAR list is the curated one, not the whole market", () => {
  // `tokens-unknown-or-better` is 1,681 tokens in 4.6 MB. It was chosen so that a
  // memecoin's `Unknown` reputation would not hide it, but that reasoning was
  // about search and it was applied to the list someone scrolls. A search is how
  // the rest of the market is reached, and reputation filtering now happens there.
  const source = readFileSync("src/bridge/catalog.ts", "utf8");
  assert.match(source, /const INTEAR_TOKENS = "[^"]*tokens-notfake-or-better"/);
  // The wider list is only allowed in the comment that explains why it went.
  assert.doesNotMatch(source, /INTEAR_TOKENS = "[^"]*unknown-or-better"/);
});

test("the catalogue makes no icon requests of its own", () => {
  // It used to look up artwork for its first 60 tokens, so opening the form cost
  // 60 requests before a row had been read, and again on every chain switch. The
  // list renders a bounded number of rows and asks for those instead.
  const source = readFileSync("src/bridge/catalog.ts", "utf8");
  assert.doesNotMatch(source, /iconsFor\(/);
});

test("the list renders a hundred rows, and the cap is a bound rather than a wall", () => {
  const list = readFileSync("src/bridge/TargetTokenList.svelte", "utf8");
  assert.match(list, /const LIST_LIMIT = 100;/);
  // It was twenty, on the argument that past twenty people are scrolling a list of
  // tokens they did not choose. True, and it did not account for the list being
  // *sorted* before it is cut: the rows that matter come first, so a small limit costs
  // a held token its row rather than merely hiding the tail. USDC was exactly that.
  //
  // It is still a bound rather than no bound — the whole list is thousands of tokens on
  // either chain, and rendering all of them is a database, not a picker.
  assert.match(
    list,
    /bounded/,
    "and the reasoning for keeping one at all is written down",
  );
  // Icons follow the render, so raising this cannot quietly mean 100 requests.
  assert.match(list, /loadIcons\(visible\.slice\(0, LIST_LIMIT\)/);
});

test("a token the account holds survives a tight list", () => {
  // The curated NEAR list is 77 tokens. Without this, tightening it would quietly
  // delete a memecoin from the picker of the one person who owns it — and a
  // holding nobody can pick is a holding they cannot receive more of.
  const source = readFileSync("src/bridge/catalog.ts", "utf8");
  assert.match(source, /merge\(bridge, aggregator, heldOnly\)/);
  assert.match(source, /h\.balance > 0n/);
});

test("the pay-with list is not indented by the browser's own list padding", () => {
  // `list-none` removes the marker but not the UA's `padding-inline-start: 40px`,
  // and this project's reset covers neither. The receive list already zeroed it;
  // this one did not, so every row sat 40px in from the card's border.
  const list = readFileSync("src/bridge/SourceTokenList.svelte", "utf8");
  const ul = list.slice(list.indexOf("<ul"));
  assert.match(ul.slice(0, 200), /p-0/);
});

// What the user can see, and what the form can spend.

test("an inlined icon is carried through, not dropped at parse time", () => {
  // Dropping `data:` icons was priced against a 1,681-token list. It also made
  // the picker quietly worse: POPPY and XAUT are inlined by the app itself, and
  // CHILL has no DexScreener pool at all, so discarding its icon left it with
  // nothing to render and nothing to fall back to. Every bridgeable token in the
  // list came out as a grey circle.
  const source = readFileSync("src/bridge/catalog.ts", "utf8");
  assert.match(source, /icon: token\.metadata\?\.icon \?\? ""/);
  // And the picker renders whatever it is given, inlined or not.
  const list = readFileSync("src/bridge/TargetTokenList.svelte", "utf8");
  assert.match(list, /return token\.icon \|\| fetchedIcons\[token\.address\]/);
});

test("only a token with no icon at all is worth a request", () => {
  // Re-asking for a token that already has artwork is the fetch storm in a
  // different costume.
  const list = readFileSync("src/bridge/TargetTokenList.svelte", "utf8");
  assert.match(list, /!row\.icon && !fetchedIcons\[row\.address\]/);
});

test("the route readout names the target, not its address", () => {
  // `labelFor` shortens anything the registry does not know, and the receive
  // picker is almost entirely such tokens — so "what happens" read `npro.n…near`
  // for every one of them, and only the handful the bridge carries showed a
  // ticker. That is why it looked like the address was showing up selectively.
  const search = readFileSync("src/bridge/search.ts", "utf8");
  assert.match(search, /input\.targetSymbol \?\? labelFor\(targetTokenId/);
  const panel = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  assert.match(panel, /targetSymbol: target\?\.symbol/);
});

test("native NEAR is spendable even when the holdings call fails", () => {
  // The From side showed no input token at all, because the list was built purely
  // from `ft_balances` and that call fails. Native NEAR is the one token the
  // account definitely has, so it cannot depend on an optional enumeration.
  const panel = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  assert.match(panel, /const native: SourceOption\[\]/);
  assert.match(panel, /toBigInt\(\) \?\? 0n/);
  // And the validity check watches the rows on offer, not the raw holdings, or it
  // would reset the selection to a token that is not being shown.
  assert.match(
    panel,
    /sourceOptions\.some\(\(o\) => o\.id === sourceTokenId\)/,
  );
});

test("native NEAR is quoted as the contract the bridge and router expect", () => {
  // It is selected as the bare id `near`, but the aggregators and the bridge want
  // the contract that represents it, or a same-chain NEAR swap is quoted against
  // an address that does not exist.
  const panel = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  assert.match(
    panel,
    /sourceTokenId === "near"\s*\?\s*\(REGISTRY\.NEAR\.addresses\.near/,
  );
});
