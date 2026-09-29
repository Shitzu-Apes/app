import assert from "node:assert/strict";
import test from "node:test";

process.env.VITE_NETWORK_ID = "mainnet";

const { clearVerifiedTagList, solanaCatalog } = await import(
  "../src/bridge/catalog.ts"
);

// The verified tag list is 3,703 tokens and about 5 MB, and it used to be fetched on
// every call. That was survivable while a catalogue was built once per chain switch; it
// stopped being survivable when the rebuild also started firing on new balances, so a
// page load where both wallets connect asked for 5 MB twice and every balance change
// asked again.
//
// The cache is module-level, so these tests share it — which is the point, and also why
// they are ordered: the first test establishes what the cache holds for the rest.

const originalFetch = globalThis.fetch;
test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

const oneToken = [
  {
    id: "MintA",
    name: "Token A",
    symbol: "TKA",
    decimals: 6,
    icon: "a.png",
    priceUsd: 1.5,
    organicScore: 99,
  },
];

let fetchCount = 0;

test("the tag list is fetched once, however many catalogues are built", async () => {
  fetchCount = 0;
  globalThis.fetch = (async (url: unknown) => {
    if (String(url).includes("/tokens/v2/tag")) {
      fetchCount++;
      return new Response(JSON.stringify(oneToken), { status: 200 });
    }
    return new Response("[]", { status: 200 });
  }) as typeof fetch;

  // Two catalogues is what a page load produces: one for the destination chain before
  // the balances land, and one after.
  await solanaCatalog();
  await solanaCatalog();
  await solanaCatalog();
  assert.equal(fetchCount, 1, "one download of 5 MB, not three");
});

test("the catalogue is still built correctly from the cached list", async () => {
  const catalog = await solanaCatalog();
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0]?.tokenId, "MintA");
  assert.equal(catalog[0]?.symbol, "TKA");
  assert.equal(catalog[0]?.icon, "a.png");
  assert.equal(catalog[0]?.decimals, 6);
  assert.equal(catalog[0]?.price, 1.5, "the list carries prices of its own");
});

test("a shared fetch is not cancelled by one caller walking away", async () => {
  // The list belongs to the page, not to one caller, so `solanaCatalog` deliberately
  // ignores the caller's AbortSignal. A request that died with the first caller to
  // navigate away would leave everyone else with nothing — and the cache would then
  // hold the failure.
  const catalog = await solanaCatalog();
  assert.ok(
    catalog.length > 0,
    "a caller with a dead signal still gets the list",
  );
});

test("a failed download is not cached, so the next attempt really tries again", async () => {
  // `getJson` answers a dead request with null rather than throwing, so a transient
  // blip held in the cache would leave the picker permanently without its Solana
  // section — for the rest of the session, and across every rebuild that a balance
  // change triggers. This is the one thing the cache must not do.
  clearVerifiedTagList();
  let attempts = 0;
  globalThis.fetch = (async () => {
    if (attempts++ === 0) return new Response("", { status: 500 });
    return new Response(JSON.stringify(oneToken), { status: 200 });
  }) as typeof fetch;

  const first = await solanaCatalog();
  assert.equal(
    first.length,
    0,
    "a failed list is a missing section, not a broken form",
  );

  const second = await solanaCatalog();
  assert.equal(attempts, 2, "so it asked again");
  assert.equal(second.length, 1, "and got the list");
});
