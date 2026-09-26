import assert from "node:assert/strict";
import test from "node:test";

import { PublicKey } from "@solana/web3.js";

process.env.VITE_NETWORK_ID = "mainnet";

const {
  WSOL_MINT,
  WNEAR_MINT,
  USDC_MINT,
  SWAP_TOKENS,
  getQuote,
  buildSwapTx,
  describeRoute,
  JupiterError,
} = await import("../src/lib/solana/jupiter.ts");

// These hit the live Jupiter API on purpose: the quote shape and the
// availability of a route are exactly what the bridge UI depends on.
const live = { skip: !process.env.JUPITER_LIVE };

test("rejects a zero amount without calling the API", async () => {
  assert.equal(await getQuote(WSOL_MINT, WNEAR_MINT, 0n), null);
});

test("returns null (not an error) when no route exists", async () => {
  // A valid but unpaired mint should surface as "unavailable".
  const bogus = "11111111111111111111111111111112";
  const quote = await getQuote(bogus, WNEAR_MINT, 1_000_000n);
  assert.equal(quote, null);
});

test("swappable token metadata matches the mints the app uses", () => {
  assert.equal(SWAP_TOKENS.SOL.mint, WSOL_MINT);
  assert.equal(SWAP_TOKENS.WNEAR.mint, WNEAR_MINT);
  assert.equal(SWAP_TOKENS.SOL.decimals, 9);
  assert.equal(SWAP_TOKENS.WNEAR.decimals, 9);
  assert.equal(SWAP_TOKENS.USDC.decimals, 6);
});

test(
  "live: SOL routes to wNEAR and respects the requested amount",
  live,
  async () => {
    const oneSol = 1_000_000_000n;
    const quote = await getQuote(WSOL_MINT, WNEAR_MINT, oneSol, 100);
    assert.ok(quote, "expected a SOL -> wNEAR route");

    assert.equal(quote.inputMint, WSOL_MINT);
    assert.equal(quote.outputMint, WNEAR_MINT);
    assert.equal(quote.inAmount, oneSol.toString());
    assert.ok(BigInt(quote.outAmount) > 0n, "expected a non-zero output");
    assert.ok(quote.routePlan.length > 0, "expected at least one hop");

    // The minimum acceptable output must be <= the quoted output.
    assert.ok(
      BigInt(quote.otherAmountThreshold) <= BigInt(quote.outAmount),
      "slippage floor must not exceed the quote",
    );
  },
);

test("live: quote output scales with input size", live, async () => {
  const small = await getQuote(WSOL_MINT, WNEAR_MINT, 1_000_000_000n, 100);
  const large = await getQuote(WSOL_MINT, WNEAR_MINT, 10_000_000_000n, 100);
  assert.ok(small && large);
  assert.ok(
    BigInt(large.outAmount) > BigInt(small.outAmount),
    "10 SOL should yield more wNEAR than 1 SOL",
  );
});

test("live: slippage tolerance is reflected in the floor", live, async () => {
  const tight = await getQuote(WSOL_MINT, WNEAR_MINT, 1_000_000_000n, 10);
  const loose = await getQuote(WSOL_MINT, WNEAR_MINT, 1_000_000_000n, 500);
  assert.ok(tight && loose);
  assert.ok(
    BigInt(tight.otherAmountThreshold) > BigInt(loose.otherAmountThreshold),
    "tighter slippage must demand a higher minimum output",
  );
});

test(
  "live: wNEAR and USDC are sellable back into the same pool",
  live,
  async () => {
    const wnear = await getQuote(WNEAR_MINT, USDC_MINT, 5_000_000_000n, 100);
    assert.ok(wnear, "expected a wNEAR -> USDC route");
    const usdc = await getQuote(USDC_MINT, WNEAR_MINT, 5_000_000n, 100);
    assert.ok(usdc, "expected a USDC -> wNEAR route");
  },
);

test(
  "live: buildSwapTx returns a deserializable transaction",
  live,
  async () => {
    const quote = await getQuote(WSOL_MINT, WNEAR_MINT, 1_000_000_000n, 100);
    assert.ok(quote);
    // A throwaway address: we only decode the transaction, never sign or send.
    const user = new PublicKey("11111111111111111111111111111112");
    const tx = await buildSwapTx(quote, user);
    assert.ok(
      tx instanceof (await import("@solana/web3.js")).VersionedTransaction,
    );
    assert.ok(tx.message.header.numRequiredSignatures >= 1);
    assert.ok(tx.message.recentBlockhash, "expected a recent blockhash");
  },
);

test("describeRoute labels the hops the user sees", live, async () => {
  const quote = await getQuote(WSOL_MINT, WNEAR_MINT, 1_000_000_000n, 100);
  assert.ok(quote);
  const route = describeRoute(quote);
  assert.match(route, /^SOL → /);
  assert.match(route, /NEAR$/);
});

test("a malformed request throws rather than reporting unavailable", async () => {
  // Jupiter answers 400 with no errorCode for bad params: that is a bug in the
  // caller, not an unavailable pair, so it must not be swallowed.
  await assert.rejects(
    () => getQuote(`${WSOL_MINT}999`, WNEAR_MINT, 1_000_000n),
    (err: unknown) => {
      assert.ok(err instanceof JupiterError);
      assert.equal(err.isUnavailable, false);
      return true;
    },
  );
});

test("an untradable token reports unavailable", async () => {
  const quote = await getQuote(
    "11111111111111111111111111111112",
    WNEAR_MINT,
    1_000_000n,
  );
  assert.equal(quote, null);
});
