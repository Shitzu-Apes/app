import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

process.env.VITE_NETWORK_ID = "mainnet";

const { runRouteTransactions } = await import(
  "../src/lib/bridge/executeNear.ts"
);

// A NEAR route is a *sequence* of dependent transactions, and the wallet signs and
// submits a sequence in one call. This drives the real function with a scripted
// wallet, because two things matter and neither needs a wallet to test: the route
// goes over as a single call, and the returned outcomes are read.

type Outcome = {
  status?: unknown;
  transaction_outcome?: { id?: string; outcome?: { logs?: string[] } };
  receipts_outcome?: { id?: string; outcome?: { logs?: string[] } }[];
};

const ok = (): Outcome => ({
  status: { SuccessValue: "" },
  transaction_outcome: { id: "Success", outcome: { logs: [] } },
  receipts_outcome: [{ id: "Success", outcome: { logs: [] } }],
});

/** A revert, spelled the way `@near-js` spells it. */
const reverted = (log: string): Outcome => ({
  status: "Failure",
  transaction_outcome: { id: "Failure", outcome: { logs: [log] } },
  receipts_outcome: [{ id: "Failure", outcome: { logs: [log] } }],
});

/** A wallet that records the batches it was handed. */
function wallet(respond: (batch: number[]) => Outcome[]) {
  const batches: number[][] = [];
  return {
    batches,
    submit: async (batch: number[]) => {
      batches.push([...batch]);
      return respond(batch);
    },
  };
}

// The real route for wrap.near -> token.0xshitzu.near at 1 NEAR, which is what
// `selectBestRoute` picks at 1 and 5 NEAR because it leaves the user most:
//
//   tx0  dex.intear.near  storage_deposit + register_assets
//   tx1  wrap.near         near_withdraw
//   tx2  dex.intear.near  deposit_near
//
// tx2 needs the native NEAR tx1 produces and the registration tx0 makes.
const PLACH = [0, 1, 2];

test("a dependent route goes to the wallet as one call, in order", async () => {
  // This is the whole point. `signAndSendTransactions` takes a sequence and the
  // wallet submits it in order — that is what the method is for, and the repo's own
  // buy/sell has always passed an array this way.
  const w = wallet(() => [ok(), ok(), ok()]);
  await runRouteTransactions(PLACH, w.submit);
  assert.equal(
    w.batches.length,
    1,
    "one wallet interaction for the whole route",
  );
  assert.deepEqual(w.batches[0], PLACH, "carrying every transaction, in order");
});

test("the call count does not grow with the number of transactions", async () => {
  // The regression: one call per transaction means N wallet interactions, of which
  // only the first is inside the user's click. The browser blocks the popups for the
  // rest, so a three-transaction route signed the storage deposit and then failed
  // to sign the swap.
  for (const count of [1, 2, 3, 4, 8]) {
    const route = Array.from({ length: count }, (_, i) => i);
    const w = wallet(() => route.map(ok));
    await runRouteTransactions(route, w.submit);
    assert.equal(
      w.batches.length,
      1,
      `${count} transactions took ${w.batches.length} calls`,
    );
  }
});

test("a single-transaction route is still one call", () => {
  // Rhea is one transaction. The common case must not change shape.
  return runRouteTransactions([0], wallet(() => [ok()]).submit);
});

test("the transaction count is announced before the call", async () => {
  // The user is about to give several signatures, and that is worth saying. It has
  // to be up front rather than per-step, because the wallet owns the sequencing and
  // there is nothing to report until it returns.
  const announced: number[] = [];
  await runRouteTransactions(
    PLACH,
    wallet(() => PLACH.map(ok)).submit,
    (total) => announced.push(total),
  );
  assert.deepEqual(announced, [3]);
});

test("a revert stops the route and names which transaction failed", async () => {
  // NEAR resolves a failed transaction rather than throwing, so the outcome has to
  // be read. Reporting success for a half-landed route is what leaves a user
  // believing they were swapped when they were not.
  const w = wallet((batch) =>
    batch.map((tx) => (tx === 1 ? reverted("slippage floor not met") : ok())),
  );
  await assert.rejects(
    runRouteTransactions(PLACH, w.submit),
    /Transaction 2 of 3 reverted: slippage floor not met/,
  );
  // One call, so there is no "was the next one sent" question to ask.
  assert.equal(w.batches.length, 1);
});

test("a failure is read from all three places a wallet can put it", async () => {
  // Only the summary `status` says "Failure" on some wallets, only the receipt `id`
  // on others, and only the transaction outcome on a third. Reading one means a
  // failed route reports as finished on the wallets that spell it another way.
  const shapes: Outcome[] = [
    { status: "Failure" },
    { status: { Failure: { index: 3 } } },
    { transaction_outcome: { id: "Failure", outcome: { logs: [] } } },
    { receipts_outcome: [{ id: "Failure", outcome: { logs: ["pool gone"] } }] },
  ];
  for (const shape of shapes) {
    await assert.rejects(
      runRouteTransactions([0], async () => [shape]),
      /Transaction 1 of 1 reverted/,
      `not detected: ${JSON.stringify(shape)}`,
    );
  }
});

test("a success spelled the other way is not read as a failure", async () => {
  // The check has to be narrow. `status` is a union, and treating any object as a
  // failure would reject every successful transaction.
  for (const status of [
    { SuccessValue: "" },
    "SuccessValue",
    "Started",
    undefined,
  ]) {
    await runRouteTransactions([0], async () => [
      {
        status,
        receipts_outcome: [{ id: "Success", outcome: { logs: [] } }],
      },
    ]);
  }
});

test("a wallet that resolves nothing is not read as a failure", async () => {
  // Some wallets return nothing at all. Treating that as a revert would fail routes
  // that actually landed.
  await runRouteTransactions([0], async () => []);
  await runRouteTransactions([0], async () => undefined as never);
});

test("a route with no transactions makes no call at all", async () => {
  const w = wallet(() => [ok()]);
  await runRouteTransactions([], w.submit);
  assert.equal(w.batches.length, 0);
});

// The wiring, because the regression was in the wiring: the right method was being
// called the wrong number of times.

const wiring = await import("node:fs").then((fs) =>
  fs.readFileSync("src/lib/bridge/executeNear.ts", "utf8"),
);

test("the wallet is handed the whole route, not one transaction at a time", () => {
  assert.match(
    wiring,
    /wallet\.signAndSendTransactions\(\{\s*transactions: route as/,
  );
  // A one-element array per call is the thing that turned one route into N
  // interactions, and it must not come back.
  assert.doesNotMatch(wiring, /transactions: \[transaction\]/);
});

test("every execution leg quotes through the retrying router call", () => {
  // The source swap, the straight-bridge path and the destination swap. The split
  // moved the source swap into its own function, so the count grew rather than
  // shrank — what matters is that none of them reaches the raw client.
  assert.ok(
    (wiring.match(/getIntearRoutesRouted\(/g) ?? []).length >= 3,
    "every NEAR swap leg retries",
  );
  assert.doesNotMatch(wiring, /[^R]getIntearRoutes\(\{/);
});

test("the progress message reports a count, not a running step", () => {
  // The wallet owns the sequencing now, so "step 2 of 3" would narrate something
  // unobservable. The count is knowable up front and is the useful part.
  assert.match(wiring, /Signing \$\{total\} transactions on Near/);
  assert.doesNotMatch(wiring, /step \$\{step\} of \$\{total\}/);
});

// The swap after the bridge is quoted with what actually lands, and a finalised
// bridge stops looking like it is still running.

test("a NEAR rail's cargo is held as native NEAR on arrival, not the wrap contract", async () => {
  // The bridge is not symmetric. Sending wNEAR out of NEAR takes the wrapped
  // contract; receiving it on NEAR delivers *native* NEAR because the payout
  // unwraps. So the destination swap has to be quoted with `near`.
  const { railAssetOnArrival } = await import("../src/lib/bridge/rail.ts");
  const rail = { sourceAddress: "wrap.near", destAddress: "wrap.near" };
  assert.equal(railAssetOnArrival(rail, "near"), "near");
  // The Solana side really is wNEAR as an SPL mint, so it needs no translation.
  assert.equal(
    railAssetOnArrival(
      { sourceAddress: "wrap.near", destAddress: "So111" },
      "solana",
    ),
    "So111",
  );
});

test("both the quote and the swap ask for the asset that actually lands", () => {
  // Source-asserted rather than executed, because `routeSearch.ts` reaches the
  // real registry and from there `$app`, which the node harness cannot resolve.
  // The behaviour of the helper itself is tested above.
  const search = readFileSync("src/lib/bridge/routeSearch.ts", "utf8");
  assert.match(
    search,
    /quoteTargetSwap:[\s\S]*?destQuoter\(railAssetOnArrival\(rail, dest\)/,
  );
  // Quoting the wrap contract here would price the route the user is shown from a
  // path that cannot execute, so the number agreed to would not be the number a
  // real route gives.
  assert.doesNotMatch(
    search,
    /destQuoter\(rail\.destAddress, targetTokenAddress/,
  );

  const panel = readFileSync("src/lib/bridge/AnyToAnyPanel.svelte", "utf8");
  assert.match(
    panel,
    /railTokenId: railAssetOnArrival\(runningPlan!\.rail!, "near"\)/,
  );
});

// The SDK identifies a NEAR transfer by scraping an event out of receipt logs, and
// throws when it is not there. Two unrelated causes produce that same message, and
// the SDK hands back no alternative — so the hash is captured on the way past.

const omni = await import("node:fs").then((fs) =>
  fs.readFileSync("src/lib/bridge/omni.ts", "utf8"),
);

test("the transaction hash is captured while the SDK is looking for its event", () => {
  assert.match(omni, /lastCapturedNearTxHash/);
  assert.match(omni, /transaction\?\.hash/);
  // Recorded on the way past, so it survives the SDK discarding the outcomes.
  assert.match(
    omni,
    /const outcomes = \(await walletTarget\.signAndSendTransactions\(/,
  );
  // And forgettable, so a stale hash cannot identify a later transfer.
  assert.match(omni, /export function clearCapturedNearTxHash/);
});

test("a missing InitTransferEvent falls back to the hash instead of failing", () => {
  const src = readFileSync("src/lib/bridge/executeNear.ts", "utf8");
  assert.match(
    src,
    /if \(!\/InitTransferEvent not found\/\.test\(String\(err\)\)\) throw err;/,
  );
  // A transfer with neither handle cannot be tracked, and saying so beats guessing.
  assert.match(src, /cannot be tracked/);
  // Both handles are returned, hash first.
  assert.match(src, /txHash: lastCapturedNearTxHash\(\),/);
  assert.match(src, /originNonce: rawEvent\?\.transfer_message\.origin_nonce,/);
});
