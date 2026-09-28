import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("keying a transfer does not throw on the shape the API actually returns", () => {
  // Regression guard, and this crashed in production. The bridge page keyed its
  // transfer list with `transfer.id?.origin_chain + ":" + transfer.id?.kind.Nonce`.
  // The optional chain covered a missing `id` but not a missing `kind`, and the
  // live API returns `{ origin_chain, origin_nonce }` with no `kind` at all, so
  // every render of a transfer with a real id threw
  // "Cannot read properties of undefined (reading 'Nonce')".
  const live = { id: { origin_chain: "Sol", origin_nonce: 732173 } };
  assert.equal(getTransferKey(live), "Sol:732173");
  // A missing id must stay non-fatal too.
  assert.equal(getTransferKey({ id: null }), "undefined:undefined");
});

test("the page keys its transfer list with the shared helper", () => {
  // The rest of the bridge already keys on getTransferKey (transfers.ts,
  // solanaToNear.ts). The list on the page was the one place that rebuilt the
  // key by hand, and it got the optional chaining wrong.
  const page = readFileSync("src/lib/bridge/NativeBridgePanel.svelte", "utf8");
  assert.match(
    page,
    /\{#each visibleTransfers as transfer \(getTransferKey\(transfer\)\)\}/,
  );
  assert.doesNotMatch(page, /kind\.Nonce/);
});

test("the page never reads a transfer through the SDK", () => {
  // This was the last call site still using OmniBridgeAPI.getTransfer, whose
  // TransferSchema requires id.kind. The live API omits it, so the call throws
  // a ZodError on every transfer; the retry loop swallowed that for 60s and
  // then reported a long-since-finalised bridge as unfindable. Reloading looked
  // fine because the history path already used fetchTransferByNonce.
  const page = readFileSync("src/lib/bridge/NativeBridgePanel.svelte", "utf8");
  assert.doesNotMatch(page, /api\.getTransfer\(/);
  assert.doesNotMatch(page, /api\.getTransferStatus\(/);
  assert.doesNotMatch(page, /findOmniTransfers\(/);
  assert.match(page, /await fetchTransferByNonce\(\s*chain,/);
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

// A NEAR deposit has no transaction hash, so it is found by its origin nonce.

test("a NEAR deposit is located by its origin nonce, not a hash", () => {
  // The API answers for both, but only a Solana deposit has a signature to ask
  // with. A NEAR deposit hands back the transfer message, and its `origin_nonce`
  // is the only handle on the transfer's progress — so the wait has to accept it,
  // or a NEAR-sourced transfer can never be waited on at all.
  const src = readFileSync("src/lib/bridge/status.ts", "utf8");
  assert.match(src, /origin\?: \{ chain: Chain; nonce: number \}/);
  assert.match(
    src,
    /origin\s*\?\s*await fetchTransferByNonce\(origin\.chain, origin\.nonce\)/,
  );
});

test("the index loop reads before it sleeps", () => {
  // The hash is a Solana receipt the indexer has to catch up with, which is why
  // there is an indexing phase at all. A nonce is known at signing, so sleeping
  // first would add an interval of dead time to every transfer, and a deposit that
  // is already indexed would be found one interval later than it could be.
  const src = readFileSync("src/lib/bridge/status.ts", "utf8");
  assert.match(src, /if \(attempt > 1\) await sleep\(intervalMs\);/);
});

test("a wait with no locator ends as unfindable rather than throwing on undefined", async () => {
  // With neither a hash nor a nonce there is nothing to look up. It has to end as
  // an unfindable transfer rather than dereferencing `undefined.txHash` deep in
  // the loop.
  const { waitForTransfer } = await import("../src/lib/bridge/status.ts");
  await assert.rejects(
    waitForTransfer({ indexTimeoutMs: 1, intervalMs: 1 }),
    /has not indexed it yet/,
  );
});

// A 404 from the bridge indexer means "not there yet", not "does not exist". Measured
// live against a transfer that was on its way to Solana: the same lookup 404s the
// instant it is asked and resolves about a second later. Failing on that killed a
// working bridge — the funds arrived and the app said the bridge did not recognise
// them.

/** A stub indexer: 404 for the first `misses` reads, then the transfer. */
function stubIndexer(misses: number, body: unknown = [{}]) {
  const original = globalThis.fetch;
  let reads = 0;
  globalThis.fetch = (async () => {
    reads++;
    if (reads <= misses) {
      return new Response("", { status: 404 });
    }
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  return {
    get reads() {
      return reads;
    },
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

const finalised = [
  {
    id: { origin_chain: "Near", origin_nonce: 562921 },
    initialized: { NearReceipt: { block_height: 1, transaction_hash: "abc" } },
    finalised: { Solana: { slot: 2, signature: "sig" } },
  },
];

test("a 404 right after signing is retried, not treated as a dead transfer", async () => {
  const { waitForTransfer } = await import("../src/lib/bridge/status.ts");
  const stub = stubIndexer(1, finalised);
  try {
    const transfer = await waitForTransfer({
      txHash: "CB9fT7GZxghTjLmZug3BijQpR2jMEVSLZLiuaaCqhq9W",
      indexTimeoutMs: 1_000,
      intervalMs: 1,
    });
    assert.ok(transfer.id, "the transfer is found on the second read");
    assert.equal(stub.reads, 2, "and the 404 did not end the wait");
  } finally {
    stub.restore();
  }
});

test("a 400 still fails at once, because waiting cannot fix a malformed lookup", async () => {
  const { waitForTransfer } = await import("../src/lib/bridge/status.ts");
  const original = globalThis.fetch;
  let reads = 0;
  globalThis.fetch = (async () => {
    reads++;
    return new Response("", { status: 400 });
  }) as typeof fetch;
  try {
    await assert.rejects(
      waitForTransfer({ txHash: "abc", indexTimeoutMs: 1_000, intervalMs: 1 }),
      /rejected the lookup/,
    );
    assert.equal(reads, 1, "one read, not the whole budget spent");
  } finally {
    globalThis.fetch = original;
  }
});

test("a 5xx keeps waiting, as it always did", async () => {
  const { waitForTransfer } = await import("../src/lib/bridge/status.ts");
  const original = globalThis.fetch;
  let reads = 0;
  globalThis.fetch = (async () => {
    reads++;
    if (reads < 3) return new Response("", { status: 503 });
    return new Response(JSON.stringify(finalised), { status: 200 });
  }) as typeof fetch;
  try {
    const transfer = await waitForTransfer({
      txHash: "abc",
      indexTimeoutMs: 1_000,
      intervalMs: 1,
    });
    assert.ok(transfer.id);
  } finally {
    globalThis.fetch = original;
  }
});

test("a timeout after only 404s blames the index, not the API", async () => {
  // "The bridge has not indexed it" is a claim about the index. If the reads were
  // failing some other way the claim is false, and it sends the user to check the
  // wrong thing.
  const { waitForTransfer } = await import("../src/lib/bridge/status.ts");
  let stub = stubIndexer(99);
  try {
    await assert.rejects(
      waitForTransfer({ txHash: "abc", indexTimeoutMs: 3, intervalMs: 1 }),
      /has not indexed it yet/,
    );
  } finally {
    stub.restore();
  }

  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("", { status: 503 })) as typeof fetch;
  try {
    await assert.rejects(
      waitForTransfer({ txHash: "abc", indexTimeoutMs: 3, intervalMs: 1 }),
      /could not be read just now/,
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("the two 404 conditions are not the same property any more", async () => {
  // Conflating them is the bug: `isNotFound` covered both 404 and 400, so the
  // not-yet-indexed case inherited the malformed-lookup behaviour.
  const { OmniApiError } = await import("../src/lib/bridge/status.ts");
  assert.equal(new OmniApiError(404, "/x").isNotIndexed, true);
  assert.equal(new OmniApiError(404, "/x").isMalformed, false);
  assert.equal(new OmniApiError(400, "/x").isMalformed, true);
  assert.equal(new OmniApiError(400, "/x").isNotIndexed, false);
  assert.equal(new OmniApiError(503, "/x").isNotIndexed, false);
  assert.equal(new OmniApiError(503, "/x").isMalformed, false);
});
