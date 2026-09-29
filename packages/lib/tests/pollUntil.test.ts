import assert from "node:assert/strict";
import test from "node:test";

import { pollUntil } from "../src/util/pollUntil.ts";

/** Records the delay of every `setTimeout` and fires it immediately. */
function recordDelays(): { delays: number[]; restore: () => void } {
  const realSetTimeout = globalThis.setTimeout;
  const delays: number[] = [];
  globalThis.setTimeout = ((
    handler: TimerHandler,
    ms?: number,
    ...args: unknown[]
  ) => {
    delays.push(ms ?? 0);
    return realSetTimeout(handler, 0, ...args);
  }) as typeof globalThis.setTimeout;
  return {
    delays,
    restore: () => {
      globalThis.setTimeout = realSetTimeout;
    },
  };
}

const realTimeout = globalThis.setTimeout;
const HANG_MS = 500;

async function settleOrHang(promise: Promise<void>): Promise<string> {
  return Promise.race([
    promise.then(() => "RESOLVED"),
    new Promise<string>((r) => realTimeout(() => r("HUNG"), HANG_MS)),
  ]);
}

test("pollUntil resolves once the value satisfies isDone", async () => {
  const timer = recordDelays();
  try {
    let calls = 0;
    const promise = pollUntil<number>({
      tick: async () => ++calls,
      isDone: (value) => value >= 3,
      refetchDelay: 2_000,
      finalDelay: 1_000,
    });
    assert.equal(await settleOrHang(promise), "RESOLVED");
    assert.equal(calls, 3);
    assert.deepEqual(timer.delays, [2_000, 2_000, 1_000]);
  } finally {
    timer.restore();
  }
});

test("pollUntil does not hang when a tick rejects, and retries it", async () => {
  const timer = recordDelays();
  try {
    let calls = 0;
    const errors: unknown[] = [];
    const promise = pollUntil<number>({
      tick: async () => {
        calls += 1;
        if (calls <= 2) throw new Error("HTTP 429: Too many requests");
        return 5;
      },
      isDone: (value) => value >= 5,
      onError: (error) => errors.push(error),
      refetchDelay: 2_000,
      finalDelay: 1_000,
    });

    // The regression: the old `new Promise(asyncExecutor)` shape leaked the
    // rejection and left this pending forever.
    assert.equal(await settleOrHang(promise), "RESOLVED");
    assert.equal(calls, 3);
    assert.equal(errors.length, 2);
    assert.deepEqual(
      errors.map((e) => (e as Error).message),
      ["HTTP 429: Too many requests", "HTTP 429: Too many requests"],
    );
    assert.deepEqual(timer.delays, [2_000, 2_000, 1_000]);
  } finally {
    timer.restore();
  }
});

test("pollUntil keeps retrying while every tick rejects, then recovers", async () => {
  const timer = recordDelays();
  try {
    let calls = 0;
    let failing = true;
    const promise = pollUntil<number>({
      tick: async () => {
        calls += 1;
        if (failing) throw new Error("HTTP 429: Too many requests");
        return 7;
      },
      isDone: (value) => value >= 7,
      refetchDelay: 2_000,
      finalDelay: 1_000,
    });

    assert.equal(await settleOrHang(promise), "HUNG");
    assert.ok(calls >= 2, `expected repeated polls, got ${calls}`);

    // Let the loop finish so the test process can exit.
    failing = false;
    assert.equal(await settleOrHang(promise), "RESOLVED");
  } finally {
    timer.restore();
  }
});

test("pollUntil reports every successfully polled value", async () => {
  const timer = recordDelays();
  try {
    const seen: number[] = [];
    let calls = 0;
    const promise = pollUntil<number>({
      tick: async () => ++calls,
      isDone: (value) => value >= 2,
      onValue: (value) => seen.push(value),
      refetchDelay: 2_000,
      finalDelay: 1_000,
    });
    assert.equal(await settleOrHang(promise), "RESOLVED");
    assert.deepEqual(seen, [1, 2]);
  } finally {
    timer.restore();
  }
});
