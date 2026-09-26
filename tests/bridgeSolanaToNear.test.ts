import assert from "node:assert/strict";
import test from "node:test";

import { PublicKey } from "@solana/web3.js";

process.env.VITE_NETWORK_ID = "mainnet";

const { getWnearBridgeFee, quoteToWnear, BridgeError } = await import(
  "../src/lib/bridge/solanaToNear.ts"
);
const { WNEAR_MINT, WSOL_MINT, USDC_MINT, describeRoute } = await import(
  "../src/lib/solana/jupiter.ts"
);

const live = { skip: !process.env.JUPITER_LIVE };
const SENDER = new PublicKey("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");
const RECIPIENT = "test.near";

test("the module targets wNEAR on Solana and NEAR as the destination", () => {
  assert.equal(WNEAR_MINT, "3ZLekZYq2qkZiSpnSvabjit34tUkjSwD1JFuW9as9wBG");
});

test(
  "live: the Omni Bridge quotes a sol->near wNEAR transfer",
  live,
  async () => {
    const fee = await getWnearBridgeFee(SENDER, RECIPIENT);
    assert.ok(fee.native_token_fee !== null, "expected a native fee");
    assert.ok(fee.transferred_token_fee !== null, "expected a token fee");
    assert.ok(BigInt(fee.native_token_fee) >= 0n);
    assert.ok(BigInt(fee.transferred_token_fee) >= 0n);
    assert.equal(typeof fee.usd_fee, "number");
  },
);

test(
  "live: the token fee is denominated in wNEAR base units",
  live,
  async () => {
    const fee = await getWnearBridgeFee(SENDER, RECIPIENT);
    // 2_397_060 base units of a 9-decimal token is ~0.0024 wNEAR.
    const asWnear = Number(fee.transferred_token_fee) / 1e9;
    assert.ok(asWnear > 0, "expected a positive wNEAR fee");
    assert.ok(asWnear < 1, `fee ${asWnear} wNEAR should be well under 1`);
  },
);

test("live: quoting SOL yields a route ending at wNEAR", live, async () => {
  const quote = await quoteToWnear(1_000_000_000n, WSOL_MINT, 100);
  assert.ok(quote);
  assert.equal(quote.outputMint, WNEAR_MINT);
  assert.match(describeRoute(quote), /NEAR$/);
});

test("live: quoting USDC yields a route ending at wNEAR", live, async () => {
  const quote = await quoteToWnear(5_000_000n, USDC_MINT, 100);
  assert.ok(quote, "expected a USDC -> wNEAR route");
  assert.equal(quote.outputMint, WNEAR_MINT);
});

test("quoting wNEAR itself is not a swap", live, async () => {
  // The bridge flow skips the swap leg entirely for wNEAR sources, so this
  // documents that we never ask Jupiter for a wNEAR -> wNEAR route.
  const quote = await quoteToWnear(1_000_000_000n, WNEAR_MINT, 100);
  assert.equal(quote, null);
});

test("BridgeError carries its cause", () => {
  const cause = new Error("boom");
  const err = new BridgeError("failed", cause);
  assert.equal(err.message, "failed");
  assert.equal(err.cause, cause);
  assert.equal(err.name, "BridgeError");
});
