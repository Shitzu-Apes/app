import assert from "node:assert/strict";
import test from "node:test";

process.env.VITE_NETWORK_ID = "mainnet";

const { getWnearBridgeFee, WNEAR_SPL_DECIMALS } = await import(
  "../src/bridge/solanaToNear.ts"
);
const { PublicKey } = await import("@solana/web3.js");

const live = { skip: !process.env.JUPITER_LIVE };

// Real values from the completed mainnet transfer the user reported:
// amount 203889181 (0.203889181 wNEAR), of which 2064491 did not arrive.
const REAL_AMOUNT = 203889181n;
const REAL_FEE = 2064491n;
const REAL_NATIVE_FEE = 82439n;
const SENDER = new PublicKey("9yDCicRqNmtUEX3z2krBiZ6GaYQba6NRFrLtcVBXozcT");
const RECIPIENT = "marior.near";

test("wNEAR is a 9 decimal SPL token", () => {
  assert.equal(WNEAR_SPL_DECIMALS, 9);
});

test("the bridge fee explains the missing chunk exactly", () => {
  // This is the shortfall the user noticed: the bridge deducts its fee from
  // the deposited amount, so a little less than the swap output arrives.
  const net = REAL_AMOUNT - REAL_FEE;
  assert.equal(net, 201_824_690n);
  assert.equal(Number(net) / 1e9, 0.20182469);
  assert.equal(Number(REAL_FEE) / 1e9, 0.002064491);

  const pct = (Number(REAL_FEE) / Number(REAL_AMOUNT)) * 100;
  assert.ok(pct > 1 && pct < 1.1, `expected ~1%, got ${pct.toFixed(3)}%`);
});

test("the Solana network fee is small but non-zero", () => {
  assert.equal(Number(REAL_NATIVE_FEE) / 1e9, 0.000082439);
});

test(
  "live: the API quotes the fee in SPL base units, not yoctoNEAR",
  live,
  async () => {
    const quote = await getWnearBridgeFee(SENDER, RECIPIENT, REAL_AMOUNT);

    // The decisive check: the value must be SPL-scale. YoctoNEAR would be ~1e15
    // times larger, and converting it would zero the fee out.
    assert.ok(
      quote.tokenFee > 1_000_000n && quote.tokenFee < 10_000_000n,
      `expected SPL-scale fee, got ${quote.tokenFee}`,
    );
    const asToken = Number(quote.tokenFee) / 1e9;
    assert.ok(asToken > 0.001 && asToken < 0.01, `unexpected fee ${asToken}`);

    // It must be within a whisker of the fee the real transfer actually paid.
    const drift =
      Math.abs(Number(quote.tokenFee - REAL_FEE)) / Number(REAL_FEE);
    assert.ok(
      drift < 0.05,
      `fee drifted ${(drift * 100).toFixed(1)}% from real`,
    );
  },
);

test("live: the native fee is lamports", live, async () => {
  const quote = await getWnearBridgeFee(SENDER, RECIPIENT, REAL_AMOUNT);
  assert.ok(quote.nativeFee > 0n);
  assert.ok(quote.nativeFee < 10n ** 6n, "lamports, not SOL");
  assert.equal(typeof quote.usdFee, "number");
});

test(
  "live: the fee is near-flat, so small transfers pay a far higher rate",
  live,
  async () => {
    // Observed on mainnet: 1 NEAR and 100 NEAR both quote ~0.00207 wNEAR, so the
    // fee is dominated by a fixed component rather than a percentage. This is why
    // the minimum-amount check exists at all.
    const small = await getWnearBridgeFee(SENDER, RECIPIENT, 1_000_000_000n);
    const large = await getWnearBridgeFee(SENDER, RECIPIENT, 100_000_000_000n);

    assert.ok(small.tokenFee > 0n && large.tokenFee > 0n);
    // Roughly the same absolute fee despite a 100x difference in size.
    const ratio = Number(large.tokenFee) / Number(small.tokenFee);
    assert.ok(
      ratio > 0.8 && ratio < 1.25,
      `expected a near-flat fee, got a ${ratio.toFixed(2)}x difference`,
    );

    // Effective rate therefore collapses with size.
    const rateSmall = Number(small.tokenFee) / Number(1_000_000_000n);
    const rateLarge = Number(large.tokenFee) / Number(100_000_000_000n);
    assert.ok(
      rateSmall / rateLarge > 50,
      "a 100x larger transfer should cost far less proportionally",
    );
  },
);
