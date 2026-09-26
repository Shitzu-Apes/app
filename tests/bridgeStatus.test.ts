import assert from "node:assert/strict";
import test from "node:test";

process.env.VITE_NETWORK_ID = "mainnet";

const {
  getTransferKey,
  getTransferNonce,
  fetchTransferByTxHash,
  fetchRecentTransfersBySender,
  fetchTransfersBySender,
  phaseOf,
  isTerminal,
  TERMINAL_STATUSES,
} = await import("../src/lib/bridge/status.ts");

// A real, completed mainnet transfer (Solana wNEAR -> NEAR).
const SOL_SIG =
  "26dVZzXxQF3zKDT9GcbScMZkaWN1mN6ZD4pxeSjaW3S43mhn6Q641czjt2nWTizuX3x9xGVS65E7a2BxcxreiAKU";
const SENDER = "sol:9yDCicRqNmtUEX3z2krBiZ6GaYQba6NRFrLtcVBXozcT";
const live = { skip: !process.env.JUPITER_LIVE };

test("the nonce is read from either id shape", () => {
  assert.equal(
    getTransferNonce({ id: { origin_chain: "Sol", origin_nonce: 7 } }),
    7,
  );
  assert.equal(
    getTransferNonce({ id: { origin_chain: "Sol", kind: { Nonce: 9 } } }),
    9,
  );
  // origin_nonce wins when both somehow appear.
  assert.equal(
    getTransferNonce({
      id: { origin_chain: "Sol", origin_nonce: 1, kind: { Nonce: 2 } },
    }),
    1,
  );
  assert.equal(getTransferNonce({ id: null }), undefined);
});

test("the transfer key is stable across both id shapes", () => {
  assert.equal(
    getTransferKey({ id: { origin_chain: "Sol", origin_nonce: 5 } }),
    "Sol:5",
  );
  assert.equal(
    getTransferKey({ id: { origin_chain: "Sol", kind: { Nonce: 5 } } }),
    "Sol:5",
  );
});

test("phases advance as receipts appear", () => {
  const base = { id: { origin_chain: "Sol", origin_nonce: 1 } } as any;
  assert.equal(phaseOf({ ...base }), "submitted");
  assert.equal(phaseOf({ ...base, initialized: {} }), "confirmed");
  assert.equal(phaseOf({ ...base, signed: {} }), "confirmed");
  assert.equal(
    phaseOf({ ...base, initialized: {}, signed: {}, fast_finalised: {} }),
    "finalising",
  );
  assert.equal(phaseOf({ ...base, finalised_on_near: {} }), "finalising");
  assert.equal(phaseOf({ ...base, finalised: {} }), "finalised");
  assert.equal(phaseOf({ ...base, claimed: {} }), "finalised");
});

test("terminal statuses are recognised", () => {
  assert.ok(isTerminal(["Finalised"]));
  assert.ok(isTerminal(["Claimed"]));
  assert.ok(isTerminal(["Initialized", "Finalised"]));
  assert.equal(isTerminal(["Initialized", "Signed"]), false);
  assert.ok(TERMINAL_STATUSES.includes("Finalised" as never));
});

test(
  "the SDK's own transfer read is broken against the live API",
  live,
  async () => {
    // Guards the reason this module exists. If a future SDK release fixes the
    // schema, this fails and we can reconsider using it.
    const { getOmniApi } = await import("../src/lib/bridge/omni.ts");
    await assert.rejects(
      () => getOmniApi().findOmniTransfers({ transaction_id: SOL_SIG }),
      /kind|Nonce|ZodError|invalid_type/i,
    );
  },
);

test(
  "live: a completed transfer reads back with the raw client",
  live,
  async () => {
    const t = await fetchTransferByTxHash(SOL_SIG);
    assert.ok(t, "expected the transfer to be found");
    assert.equal(t!.id?.origin_chain, "Sol");
    assert.equal(typeof getTransferNonce(t!), "number");
    assert.equal(phaseOf(t!), "finalised");
    assert.equal(t!.transfer_message?.sender, SENDER);
    assert.equal(
      t!.transfer_message?.token,
      "sol:3ZLekZYq2qkZiSpnSvabjit34tUkjSwD1JFuW9as9wBG",
    );
    assert.equal(t!.transfer_message?.recipient?.startsWith("near:"), true);
  },
);

test(
  "live: the sender query returns the newest transfers, not the oldest",
  live,
  async () => {
    // The API returns ascending by nonce and caps `limit` at 50. Asking for a
    // small page silently hid the newest transfers, which is exactly what the
    // "did my deposit land?" check needs. This asserts the known most-recent
    // transfer is present.
    const all = await fetchTransfersBySender(SENDER);
    assert.ok(all.length > 0, "expected some transfers");

    const nonces = all.map((t) => getTransferNonce(t)!);
    assert.ok(
      nonces.every((n) => typeof n === "number"),
      "every nonce present",
    );

    // The sender's newest transfer is nonce 732173.
    assert.ok(
      nonces.includes(732173),
      `expected the newest transfer to be included, got max ${Math.max(...nonces)}`,
    );

    // And it must not be truncated at a page boundary: we know from the API that
    // this sender has 33 transfers, so a 25-item page would have hidden the last 8.
    assert.ok(all.length >= 33, `expected all 33 transfers, got ${all.length}`);
  },
);

test("live: the most recent N come back newest-first", live, async () => {
  const recent = await fetchRecentTransfersBySender(SENDER, 3);
  assert.equal(recent.length, 3);
  const nonces = recent.map((t) => getTransferNonce(t)!);
  // Newest first, which is what a history list should render.
  assert.ok(
    nonces[0] > nonces[1] && nonces[1] > nonces[2],
    `expected descending nonces, got ${nonces}`,
  );
  // And the first entry really is the sender's newest transfer.
  const all = await fetchTransfersBySender(SENDER);
  assert.equal(
    getTransferNonce(recent[0])!,
    getTransferNonce(all[all.length - 1])!,
  );
});

test("live: a sender with no history returns an empty list", live, async () => {
  const none = await fetchTransfersBySender(
    "sol:11111111111111111111111111111112",
  );
  assert.deepEqual(none, []);
});

test(
  "live: waitForTransfer resolves a finished transfer promptly",
  live,
  async () => {
    const { waitForTransfer } = await import("../src/lib/bridge/status.ts");
    const seen: string[] = [];
    const t = await waitForTransfer({
      txHash: SOL_SIG,
      intervalMs: 500,
      indexTimeoutMs: 15_000,
      finaliseTimeoutMs: 15_000,
      onPhase: (p) => seen.push(p),
    });
    assert.equal(phaseOf(t), "finalised");
    assert.ok(
      seen.includes("finalised"),
      `expected a finalised phase, saw ${seen}`,
    );
  },
);
