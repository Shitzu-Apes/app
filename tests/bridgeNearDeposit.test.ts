import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  isFailureSignal,
  isReverted,
  revertLog,
} from "../src/lib/near/outcome.ts";

// The Omni SDK identifies a NEAR transfer by scraping an `InitTransferEvent` out of
// the returned receipts' logs, and throws when it is not there. That single message
// covers two unrelated causes, and confusing them is what put a checkmark on a
// transfer that did not exist.

test("a failure is recognised in all three places a wallet reports it", () => {
  assert.equal(isFailureSignal("Failure"), true);
  assert.equal(isFailureSignal({ Failure: { index: 3 } }), true);
  assert.equal(isFailureSignal({ SuccessValue: "" }), false);
  // A wallet that reports only what it feels like reporting.
  assert.equal(isFailureSignal(undefined), false);
  assert.equal(isFailureSignal("SuccessValue"), false);
});

test("an outcome that reverted anywhere reads as reverted", () => {
  assert.equal(isReverted({ status: "Failure" }), true);
  assert.equal(isReverted({ transaction_outcome: { id: "Failure" } }), true);
  assert.equal(
    isReverted({
      receipts_outcome: [{ id: "Failure", outcome: { logs: [] } }],
    }),
    true,
  );
  assert.equal(
    isReverted({
      status: { SuccessValue: "" },
      receipts_outcome: [{ id: "Success", outcome: { logs: [] } }],
    }),
    false,
  );
  // A wallet that returns nothing has not said it failed.
  assert.equal(isReverted(undefined), false);
});

test("the revert reason comes from the receipt that carries it", () => {
  // The only thing that says *why* — a slippage floor and a stale pool reservation
  // are otherwise the same failure.
  assert.equal(
    revertLog({
      receipts_outcome: [{ id: "Failure", outcome: { logs: ["pool gone"] } }],
    }),
    "pool gone",
  );
  assert.equal(
    revertLog({
      transaction_outcome: { id: "Failure", outcome: { logs: ["t"] } },
    }),
    "t",
  );
  assert.equal(revertLog({ status: "Success" }), undefined);
});

test("a failed deposit never falls back to its transaction hash", () => {
  // The regression. The event is missing when the batch *failed* just as often as
  // when the wallet withholds the logs, and a hash from a failed batch identifies
  // nothing: the bridge API 404s on it for the whole attempt budget while the step
  // shows a checkmark. The failure state is recorded with the hash so this decision
  // can be made before anything is invented.
  const src = readFileSync("src/lib/bridge/executeNear.ts", "utf8");
  assert.match(src, /if \(sent\.reverted\)/);
  assert.match(src, /rejected by NEAR, so nothing was bridged/);
  // Order is the point: the failure check has to come before the hash is accepted,
  // or a reverted batch still gets a handle invented for it.
  const revertedAt = src.indexOf("if (sent.reverted)");
  const hashAt = src.indexOf("if (!sent.txHash)");
  assert.ok(revertedAt > 0 && hashAt > revertedAt, "failure is checked first");
});

test("the send is forgettable, so a stale hash cannot identify a later transfer", () => {
  const omni = readFileSync("src/lib/bridge/omni.ts", "utf8");
  assert.match(omni, /export function clearCapturedNearTxHash/);
  assert.match(omni, /reverted: \(outcomes \?\? \[\]\)\.some/);
});

test("a 404 is 'not indexed yet', and only a 400 ends the wait at once", () => {
  // This used to be the other way round, on the reasoning that an unknown hash is 404
  // and so a 404 must be permanent. That is true of a hash that was never submitted
  // and false of one that was — measured live, the same lookup 404s the instant it is
  // asked and resolves about a second later. Failing on it killed a bridge that was
  // working: the funds finalised on Solana and the app said the bridge did not
  // recognise the transfer.
  //
  // The two cannot be told apart on the first read, so the index phase's own timeout
  // is what separates "still indexing" from "never heard of it". A 400 is the one
  // status that can be dismissed immediately, because nothing about waiting changes a
  // request the API has already rejected as malformed.
  const src = readFileSync("src/lib/bridge/status.ts", "utf8");
  assert.match(src, /export class OmniApiError/);
  assert.match(
    src,
    /get isMalformed\(\): boolean \{\s*return this\.status === 400;/,
  );
  assert.match(
    src,
    /get isNotIndexed\(\): boolean \{\s*return this\.status === 404;/,
  );
  // And neither 404 nor 400 is lumped into one property any more, which is what let
  // the not-yet case inherit the permanent-answer behaviour.
  assert.doesNotMatch(src, /isNotFound/);
  assert.match(src, /err\.isMalformed/);
  // A 5xx or a dropped connection is still worth waiting out, and so is a 404.
  assert.match(src, /keep polling; the indexer can lag or briefly fail/);
});
