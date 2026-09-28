import { Connection } from "@solana/web3.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createHttpConfirmConnection,
  isSignature,
  pollSignatureStatus,
  type SignatureStatusLike,
} from "../src/lib/solana/connection.ts";

const live = { skip: !process.env.SOLANA_LIVE };
const MAINNET = "https://api.mainnet-beta.solana.com/";
const WALLET = readFileSync("src/lib/solana/wallet.ts", "utf8");
const CONN_SRC = readFileSync("src/lib/solana/connection.ts", "utf8");

/** Strip comments so prose about the bug cannot trip the assertions. */
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const SIG =
  "26dVZzXxQF3zKDT9GcbScMZkaWN1mN6ZD4pxeSjaW3S43mhn6Q641czjt2nWTizuX3x9xGVS65E7a2BxcxreiAKU";

test("the wallet builds its connection with the HTTP-confirming factory", () => {
  assert.match(WALLET, /createHttpConfirmConnection\(/);
  assert.doesNotMatch(code(WALLET), /new Connection\(/);
});

test("no websocket is used anywhere in the connection code", () => {
  const c = code(CONN_SRC);
  assert.doesNotMatch(c, /signatureSubscribe/i);
  assert.doesNotMatch(c, /_rpcWebSocket/);
  assert.match(c, /getSignatureStatuses/);
});

test("it returns a real Connection so it stays assignable", () => {
  const c = createHttpConfirmConnection(MAINNET);
  assert.ok(c instanceof Connection);
  assert.equal(typeof c.getSignatureStatuses, "function");
});

test("base58 length is not byte length: decode to classify", () => {
  // A signature decodes to 64 bytes, a legacy blockhash to 32.
  assert.equal(isSignature(SIG), true);
  assert.equal(isSignature("11111111111111111111111111111111"), false);
  assert.equal(isSignature(undefined), false);
  assert.equal(isSignature("not base58 !!!"), false);
  assert.equal(isSignature(""), false);
});

/** Deterministic stand-in for the cluster. */
function fakeCluster(sequence: (SignatureStatusLike | undefined)[]) {
  let call = 0;
  return async () => {
    const value = sequence[Math.min(call, sequence.length - 1)];
    call++;
    return { context: { slot: 1000 + call }, value: [value ?? null] };
  };
}

const noSleep = async () => {};

test("resolves as soon as the status is confirmed", async () => {
  const get = fakeCluster([
    null,
    null,
    { err: null, confirmationStatus: "confirmed" },
  ]);
  const res = await pollSignatureStatus(get, SIG, "confirmed", {
    sleep: noSleep,
    timeoutMs: 60_000,
  });
  assert.equal(res.value?.err, null);
});

test("surfaces an on-chain error instead of retrying forever", async () => {
  const get = fakeCluster([
    { err: { InstructionError: [0, "Custom"] }, confirmationStatus: null },
  ]);
  const res = await pollSignatureStatus(get, SIG, "confirmed", {
    sleep: noSleep,
    timeoutMs: 60_000,
  });
  assert.ok(res.value?.err, "expected the chain error to surface");
});

test("gives up at the budget rather than hanging on an unknown signature", async () => {
  // The cluster prunes old statuses, so a signature can report null forever.
  const get = fakeCluster([null]);
  const res = await pollSignatureStatus(get, SIG, "confirmed", {
    sleep: noSleep,
    timeoutMs: 0,
  });
  assert.deepEqual(res.value?.err, { transactionExpired: true });
});

test("'finalized' satisfies a 'confirmed' request but not the reverse", async () => {
  const final = fakeCluster([{ err: null, confirmationStatus: "finalized" }]);
  assert.equal(
    (await pollSignatureStatus(final, SIG, "confirmed", { sleep: noSleep }))
      .value?.err,
    null,
  );

  const processed = fakeCluster([
    { err: null, confirmationStatus: "processed" },
  ]);
  const res = await pollSignatureStatus(processed, SIG, "confirmed", {
    sleep: noSleep,
    timeoutMs: 0,
  });
  assert.deepEqual(res.value?.err, { transactionExpired: true });
});

test("'processed' is accepted when that is what was asked for", async () => {
  const get = fakeCluster([{ err: null, confirmationStatus: "processed" }]);
  const res = await pollSignatureStatus(get, SIG, "processed", {
    sleep: noSleep,
    timeoutMs: 0,
  });
  assert.equal(res.value?.err, null);
});

test(
  "live: getSignatureStatuses itself is fast on the public cluster",
  live,
  async () => {
    const c = new Connection(MAINNET);
    const started = Date.now();
    await c.getSignatureStatuses([SIG]);
    assert.ok(Date.now() - started < 3_000);
  },
);

test(
  "live: the replacement returns a bounded answer for an unlanded signature",
  live,
  async () => {
    const c = createHttpConfirmConnection(MAINNET, "confirmed", {
      timeoutMs: 6_000,
    });
    const started = Date.now();
    const res = await Promise.race([
      c.confirmTransaction(SIG, "confirmed"),
      new Promise((r) => setTimeout(() => r("hung"), 20_000)),
    ]);
    assert.notEqual(res, "hung", "confirmTransaction must never hang");
    assert.ok(Date.now() - started < 20_000);
  },
);
