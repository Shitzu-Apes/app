import assert from "node:assert/strict";
import test from "node:test";

import type { Registry } from "../src/bridge/rail.ts";
import {
  loadNearHoldings,
  type NearBalancesDeps,
} from "../src/near/holdings.ts";

const registry: Registry = {
  NEAR: {
    symbol: "NEAR",
    icon: "/wnear.webp",
    decimals: { near: 24, solana: 9 },
    addresses: { near: "wrap.near", solana: "3ZLek" },
  },
  SHITZU: {
    symbol: "SHITZU",
    icon: "/s.webp",
    decimals: { near: 18, solana: 9 },
    addresses: { near: "token.0xshitzu.near", solana: "AFbJW5" },
  },
};

function deps(over: Partial<NearBalancesDeps> = {}): NearBalancesDeps {
  return {
    // The enriched source is primary, so a fixture that means to exercise the
    // enumeration path has to opt out of it explicitly.
    userTokens: async () => null,
    fastNearBalances: async () => ({}),
    // The RPC enumeration is the backstop now, so it defaults to "cannot answer"
    // rather than to the same answer as the primary — a test that means to
    // exercise one of them has to say which.
    ftBalances: async () => null,
    balanceOf: async () => null,
    nearBalance: async () => null,
    metadata: async () => null,
    ...over,
  };
}

test("the bulk call finds everything in one request", async () => {
  let bulkCalls = 0;
  const holdings = await loadNearHoldings(
    "alice.near",
    registry,
    deps({
      fastNearBalances: async () => {
        bulkCalls++;
        return {
          "wrap.near": "5000000000000000000000000",
          "token.0xshitzu.near": "1000000000000000000",
        };
      },
      metadata: async (id) =>
        id === "wrap.near"
          ? { symbol: "NEAR", decimals: 24 }
          : { symbol: "SHITZU", decimals: 18 },
    }),
  );

  assert.equal(bulkCalls, 1);
  assert.equal(holdings.length, 2);
  const shitzu = holdings.find((h) => h.tokenId === "token.0xshitzu.near");
  assert.equal(shitzu?.balance, 1_000_000_000_000_000_000n);
  assert.equal(shitzu?.decimals, 18);
  assert.equal(shitzu?.symbol, "SHITZU");
});

test("a registered but empty balance is not a holding", async () => {
  // An account is registered for every token it has ever touched, so a zero is a
  // registration rather than a holding and would pad the picker.
  const holdings = await loadNearHoldings(
    "alice.near",
    registry,
    deps({
      fastNearBalances: async () => ({
        "wrap.near": "0",
        "token.0xshitzu.near": "1",
      }),
    }),
  );
  assert.equal(holdings.length, 1);
  assert.equal(holdings[0].tokenId, "token.0xshitzu.near");
});

test("the registry's decimals win over a token's own metadata", async () => {
  // The bridge moves the token at these decimals, so a disagreement with the
  // token's metadata has to resolve in the bridge's favour.
  const holdings = await loadNearHoldings(
    "alice.near",
    registry,
    deps({
      fastNearBalances: async () => ({ "token.0xshitzu.near": "1000" }),
      metadata: async () => ({ symbol: "SHITZU", decimals: 6 }),
    }),
  );
  assert.equal(holdings[0].decimals, 18);
});

test("a provider that cannot enumerate falls back to asking", async () => {
  // Some RPC providers do not index ft_balances, and an account with no NEP-141
  // registrations returns null rather than an empty object. Showing an empty list
  // would have the user conclude they hold nothing.
  const asked: string[] = [];
  const holdings = await loadNearHoldings(
    "alice.near",
    registry,
    deps({
      fastNearBalances: async () => null,
      ftBalances: async () => null,
      balanceOf: async (tokenId) => {
        asked.push(tokenId);
        return tokenId === "token.0xshitzu.near" ? "2000" : null;
      },
      metadata: async () => ({ symbol: "SHITZU", decimals: 18 }),
    }),
  );
  assert.ok(
    asked.includes("token.0xshitzu.near"),
    "the bridge assets are checked",
  );
  assert.ok(asked.includes("wrap.near"), "wrapped NEAR is checked");
  assert.equal(holdings.length, 1);
  assert.equal(holdings[0].balance, 2000n);
});

test("the fallback is bounded rather than the whole catalogue", async () => {
  // Asking for all 1,600+ NEAR tokens would be 1,600 view calls.
  let asked = 0;
  await loadNearHoldings(
    "alice.near",
    registry,
    deps({
      fastNearBalances: async () => null,
      ftBalances: async () => null,
      balanceOf: async () => {
        asked++;
        return null;
      },
    }),
  );
  assert.ok(asked <= 5, `expected a handful of calls, made ${asked}`);
});

test("native NEAR is included and is never given decimals of its own", async () => {
  const holdings = await loadNearHoldings(
    "alice.near",
    registry,
    deps({
      fastNearBalances: async () => null,
      ftBalances: async () => null,
      nearBalance: async () => "3000000000000000000000000",
    }),
  );
  const native = holdings.find((h) => h.tokenId === "near");
  assert.ok(native, "native NEAR must be listed");
  assert.equal(native.decimals, 24);
  assert.equal(native.symbol, "NEAR");
});

test("holdings sort by value when they can be priced", async () => {
  // 1,000 SHITZU at $0.003 is $3; 1 wrap.near at $5 is $5. Ordering by raw balance
  // would put a thousand of a memecoin first, which is the case that makes a
  // wallet unusable.
  const holdings = await loadNearHoldings(
    "alice.near",
    registry,
    deps({
      fastNearBalances: async () => ({
        "wrap.near": "1000000000000000000000000",
        "token.0xshitzu.near": "1000000000000000000",
      }),
      metadata: async (id) =>
        id === "wrap.near"
          ? { symbol: "NEAR", decimals: 24 }
          : { symbol: "SHITZU", decimals: 18 },
    }),
    (ids) => new Map(ids.map((id) => [id, id === "wrap.near" ? 5 : 0.003])),
  );
  assert.deepEqual(
    holdings.map((h) => h.tokenId),
    ["wrap.near", "token.0xshitzu.near"],
  );
});

test("an unpriced holding still sorts, and above an unpriced dust balance", async () => {
  const holdings = await loadNearHoldings(
    "alice.near",
    registry,
    deps({
      fastNearBalances: async () => ({
        "token.0xshitzu.near": "1000000000000000000",
        "some.other.near": "5",
      }),
    }),
  );
  assert.equal(holdings[0].tokenId, "token.0xshitzu.near");
});

test("a malformed entry does not lose the rest of the balances", async () => {
  const holdings = await loadNearHoldings(
    "alice.near",
    registry,
    deps({
      fastNearBalances: async () => ({
        "wrap.near": "1000",
        "broken.near": "not-a-number",
      }),
    }),
  );
  assert.equal(holdings.length, 1);
  assert.equal(holdings[0].tokenId, "wrap.near");
});

test("an account holding nothing is an empty list, not an error", async () => {
  const holdings = await loadNearHoldings("alice.near", registry, deps());
  assert.deepEqual(holdings, []);
});

test("a failing bulk call degrades to the fallback instead of throwing", async () => {
  const holdings = await loadNearHoldings(
    "alice.near",
    registry,
    deps({
      fastNearBalances: async () => {
        throw new Error("provider does not support this method");
      },
      nearBalance: async () => "1000",
    }),
  );
  assert.equal(holdings.length, 1);
  assert.equal(holdings[0].tokenId, "near");
});

// Which enumeration answers, and what the picker does when none of them do.

test("FastNear is asked first, and the RPC enumeration only behind it", async () => {
  // `ft_balances` is the enumeration most likely to be unavailable — it answers
  // null for an account with no registrations and some providers do not index it
  // at all. Making it primary is why the NEAR side could show nothing but native
  // NEAR; making FastNear primary is the fix, so the order is worth pinning.
  const order: string[] = [];
  const holdings = await loadNearHoldings(
    "alice.near",
    registry,
    deps({
      fastNearBalances: async () => {
        order.push("fastnear");
        return { "token.0xshitzu.near": "1000" };
      },
      ftBalances: async () => {
        order.push("ft_balances");
        return { "token.cheddar.near": "5" };
      },
      nearBalance: async () => null,
    }),
  );
  assert.deepEqual(order, ["fastnear"]);
  // FastNear's answer is the one that is used, and the other source is not
  // consulted for tokens it already found.
  assert.deepEqual(
    holdings.map((h) => h.tokenId),
    ["token.0xshitzu.near"],
  );
});

test("the RPC enumeration still answers when FastNear is unreachable", async () => {
  // A backstop that is never exercised is not a backstop.
  const holdings = await loadNearHoldings(
    "alice.near",
    registry,
    deps({
      fastNearBalances: async () => {
        throw new Error("fastnear down");
      },
      ftBalances: async () => ({ "token.0xshitzu.near": "1000" }),
    }),
  );
  assert.deepEqual(
    holdings.map((h) => h.tokenId),
    ["token.0xshitzu.near"],
  );
});

test("native NEAR joins a list that came from an enumeration", async () => {
  // Neither FastNor `ft_balances` enumerates native NEAR, because it is not a
  // NEP-141 registration. The account's own chain missing from a list of what the
  // account holds is a strange thing to have to explain.
  const holdings = await loadNearHoldings(
    "alice.near",
    registry,
    deps({
      fastNearBalances: async () => ({ "token.0xshitzu.near": "1000" }),
      nearBalance: async () => "5000000000000000000000000",
    }),
  );
  assert.ok(holdings.some((h) => h.tokenId === "near" && h.balance > 0n));
});

// The enriched source: balances, metadata and prices in one request.

test("the enriched source is used whole, with no per-token calls behind it", async () => {
  // It carries balances, metadata *and* a price together, which is what makes it
  // worth asking first: the alternative was a balance index that then needed
  // `ft_metadata` per token, 68 RPC calls for one wallet.
  let metadataCalls = 0;
  const holdings = await loadNearHoldings(
    "alice.near",
    registry,
    deps({
      userTokens: async () => [
        {
          tokenId: "token.0xshitzu.near",
          balance: 1_000n,
          decimals: 18,
          symbol: "SHITZU",
          icon: "/s.webp",
          price: 0.5,
          usdValue: 0.0000000000000005,
        },
      ],
      metadata: async () => {
        metadataCalls++;
        return null;
      },
    }),
  );
  assert.equal(metadataCalls, 0, "nothing is asked of the chain");
  assert.equal(holdings.length, 1);
  assert.equal(holdings[0].symbol, "SHITZU");
  assert.equal(holdings[0].price, 0.5);
});

test("holdings are ordered by value, so the wallet's best token is first", async () => {
  // The NEAR side used to show no ordering at all, because nothing supplied a
  // price: a wallet holding one meaningful balance was buried under a million of
  // a worthless token, which is the ordering the Solana side has always had.
  const holdings = await loadNearHoldings(
    "alice.near",
    registry,
    deps({
      userTokens: async () => [
        {
          tokenId: "dust.near",
          balance: 10n ** 30n,
          decimals: 18,
          symbol: "DUST",
        },
        {
          tokenId: "token.0xshitzu.near",
          balance: 1_000_000n,
          decimals: 18,
          symbol: "SHITZU",
          price: 0.5,
          usdValue: 500,
        },
        {
          tokenId: "mid.near",
          balance: 10n ** 20n,
          decimals: 18,
          symbol: "MID",
        },
      ],
    }),
  );
  // The priced holding first, then the unpriced ones by balance.
  assert.equal(holdings[0].symbol, "SHITZU");
  assert.equal(
    holdings.findIndex((h) => h.symbol === "DUST"),
    1,
    "a token with a million units outranks one with fewer but no price",
  );
});

test("a zero balance from the enriched source is not a holding", async () => {
  // The endpoint answers every registration, and a long-lived account has a lot
  // of dust it has moved on from: 149 registrations of which 68 were real.
  const holdings = await loadNearHoldings(
    "alice.near",
    registry,
    deps({
      userTokens: async () => [
        { tokenId: "gone.near", balance: 0n, decimals: 18, symbol: "GONE" },
        {
          tokenId: "token.0xshitzu.near",
          balance: 5n,
          decimals: 18,
          symbol: "SH",
        },
      ],
      nearBalance: async () => null,
    }),
  );
  assert.equal(holdings.length, 1);
  assert.equal(holdings[0].symbol, "SH");
});

test("native NEAR still joins a list that came from the enriched source", async () => {
  // No enumeration carries it, because it is not a NEP-141 registration.
  const holdings = await loadNearHoldings(
    "alice.near",
    registry,
    deps({
      userTokens: async () => [
        {
          tokenId: "token.0xshitzu.near",
          balance: 5n,
          decimals: 18,
          symbol: "SH",
        },
      ],
      nearBalance: async () => "5000000000000000000000000",
    }),
  );
  assert.ok(holdings.some((h) => h.tokenId === "near" && h.balance > 0n));
});
