import assert from "node:assert/strict";
import test from "node:test";

process.env.VITE_NETWORK_ID = "mainnet";

const { searchRoutes } = await import("../src/lib/bridge/search.ts");

// A route the bridge charges for whether or not a swap is involved, and a conversion
// that is not a conversion at all. Both were getting the wrong answer in opposite
// directions: the fee was reported as nothing on the one route that is simplest, and a
// token that is already on the chain it is being sent to was reported as unroutable.

const registry = {
  NEAR: {
    symbol: "NEAR",
    icon: "",
    decimals: { near: 24, solana: 9 },
    addresses: { near: "wrap.near", solana: "SoW" },
  },
  SHITZU: {
    symbol: "SHITZU",
    icon: "",
    decimals: { near: 18, solana: 9 },
    addresses: { near: "token.0xshitzu.near", solana: "SHZ" },
  },
} as never;

const leg = {
  guaranteedOut: 2_000_000_000_000_000_000_000_000n,
  estimatedOut: 2_500_000_000_000_000_000_000_000n,
  guaranteedOutUsd: 0.9,
  estimatedOutUsd: 0.95,
};

const ONE = 1_000_000_000_000_000_000_000_000n;

function countingDeps(fee = 1_000_000n) {
  const calls = { fee: 0, swap: 0 };
  return {
    calls,
    deps: {
      quoteSourceSwap: async () => {
        calls.swap++;
        return leg;
      },
      quoteTargetSwap: async () => leg,
      quoteBridgeFee: async () => {
        calls.fee++;
        return { tokenFee: fee, nativeFee: 0n, usdFee: 0.01 };
      },
      quoteSameChainSwap: async () => {
        calls.swap++;
        return leg;
      },
    },
  };
}

test("a straight bridge still quotes the bridge fee", async () => {
  // The fee was skipped whenever there was no source swap, and "no source swap" *is*
  // the straight bridge — so the simplest route in the form was the only one whose fee
  // was reported as nothing, while the bridge went on charging it. The summary said no
  // fee and the deposit took one, and both numbers were true.
  const { calls, deps } = countingDeps();
  const result = await searchRoutes(
    {
      registry,
      source: "near",
      dest: "solana",
      sourceTokenId: "SHITZU",
      sourceAddress: "token.0xshitzu.near",
      targetTokenId: "SHITZU",
      targetAddress: "SHZ",
      amount: ONE,
    } as never,
    deps as never,
  );
  const direct = result.plans.find((p) => p.rail?.tokenId === "SHITZU");
  assert.ok(direct, "the straight bridge routes");
  // Once per rail considered, and the straight bridge is one of them: the NEAR rail
  // also quotes, because it routes via a swap. What matters is that the direct one did.
  assert.equal(calls.fee, 2, "both rails quoted, including the direct bridge");
  assert.equal(direct?.tokenFee, 1_000_000n, "and it is on the plan, not zero");
});

test("a route that does swap quotes the fee once, too", async () => {
  const { calls, deps } = countingDeps();
  await searchRoutes(
    {
      registry,
      source: "near",
      dest: "solana",
      sourceTokenId: "usdc.tether-token.near",
      sourceAddress: "usdc.tether-token.near",
      targetTokenId: "SHITZU",
      targetAddress: "SHZ",
      amount: ONE,
    } as never,
    deps as never,
  );
  assert.equal(calls.fee, 2, "once per rail, including the swapped one");
});

test("a token already on the chain it is being sent to costs no request", async () => {
  const { calls, deps } = countingDeps();
  const result = await searchRoutes(
    {
      registry,
      source: "near",
      dest: "near",
      sourceTokenId: "NEAR",
      targetTokenId: "NEAR",
      amount: ONE,
    } as never,
    deps as never,
  );
  assert.equal(
    calls.swap,
    0,
    "the router is not asked to quote a token into itself",
  );
  assert.equal(calls.fee, 0, "and there is no bridge to charge for");
  assert.equal(result.plans.length, 0, "there is nothing to do");
  assert.deepEqual(
    result.rejected.map((r) => r.reason),
    ["nothing-to-do"],
  );
});

test("the same token is recognised by address, not only by id", async () => {
  // A wallet knows a token by its contract and the registry by a key, and the two
  // disagree even for the same token — `wrap.near` against `NEAR`. Comparing only the id
  // asked the router to quote a swap of a token into itself, which is a request whose
  // answer cannot be used for anything.
  const { calls, deps } = countingDeps();
  const result = await searchRoutes(
    {
      registry,
      source: "near",
      dest: "near",
      sourceTokenId: "NEAR",
      sourceAddress: "wrap.near",
      targetTokenId: "NEAR",
      targetAddress: "wrap.near",
      amount: ONE,
    } as never,
    deps as never,
  );
  assert.equal(calls.swap, 0, "no request for the same token under two names");
  assert.equal(result.rejected[0]?.reason, "nothing-to-do");
});

test("two different tokens on the same chain are still a real conversion", async () => {
  const { calls, deps } = countingDeps();
  const result = await searchRoutes(
    {
      registry,
      source: "near",
      dest: "near",
      sourceTokenId: "NEAR",
      sourceAddress: "wrap.near",
      targetTokenId: "token.0xshitzu.near",
      targetAddress: "token.0xshitzu.near",
      amount: ONE,
    } as never,
    deps as never,
  );
  assert.equal(calls.swap, 1, "the router is asked, as it should be");
  assert.ok(result.plans.length > 0);
});
