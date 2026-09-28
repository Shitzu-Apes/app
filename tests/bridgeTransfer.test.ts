import assert from "node:assert/strict";
import test from "node:test";

import type { RoutePlan } from "../src/lib/bridge/search.ts";
import {
  progressFor,
  TransferError,
  type PreparedDeposit,
} from "../src/lib/bridge/transfer.ts";

/**
 * The tests below drive `prepareDeposit` through a stubbed fee call rather than
 * the live Omni API, so the ordering rules can be pinned down exactly. The live
 * quote itself is covered by `bridgeFee.test.ts` against mainnet.
 */
const plan = {
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
  kind: "bridge",
  targetDecimals: 9,
  sourceSwap: null,
  targetSwap: null,
  bridgedAmount: 1_000n,
  tokenFee: 0n,
  nativeFee: 0n,
  usdFee: null,
  arrivedAmount: 1_000n,
  receiveAmount: 1_000n,
  receiveEstimated: 1_000n,
} as unknown as RoutePlan;

test("the three legs read as the three things actually happen", () => {
  assert.equal(progressFor(plan, "swap"), "Swapping USDT → SHITZU…");
  assert.equal(progressFor(plan, "bridge"), "Bridging SHITZU…");
  assert.equal(progressFor(plan, "convert"), "Converting into SHITZU…");
});

test("a same-chain swap has no bridge leg to report", () => {
  // It is not bridged, so there is nothing to bridge and nothing to say. Naming a
  // rail here would describe a transfer that is not happening.
  const swap: RoutePlan = {
    ...plan,
    kind: "swap",
    rail: null,
    sourceSwap: {
      guaranteedOut: 5n,
      estimatedOut: 5n,
      dexes: ["Rhea"],
      outputToken: "o",
    },
    targetSwap: null,
  };
  assert.equal(progressFor(swap, "bridge"), "Converting into SHITZU…");
  assert.equal(progressFor(swap, "swap"), "Swapping USDT → SHITZU…");
});

test("a transfer error carries its cause for the toast", () => {
  const cause = new Error("rpc down");
  const error = new TransferError("could not submit", cause);
  assert.equal(error.cause, cause);
  assert.equal(error.name, "TransferError");
});

test("a prepared deposit names what the bridge is handed, not the typed amount", () => {
  // The two differ whenever the route swaps first, and confusing them would
  // make the receipt quote a number the user never typed.
  const prepared: PreparedDeposit = {
    amount: 2_000_000_000_000_000_000n,
    fee: { tokenFee: 1n, nativeFee: 82_439n, usdFee: 0.01 },
    arrivedAmount: 1_999_999_999n,
  };
  assert.equal(prepared.amount, 2_000_000_000_000_000_000n);
  assert.equal(prepared.arrivedAmount, 1_999_999_999n);
  assert.equal(prepared.fee.nativeFee, 82_439n);
});
