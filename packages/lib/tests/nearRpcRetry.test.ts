import assert from "node:assert/strict";
import test from "node:test";

import {
  linearBackoff,
  rpcFetch,
  RpcResponseError,
} from "../src/near/rpc-retry.ts";

const NODE = "https://rpc.example.test";

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    statusText: status === 429 ? "Too Many Requests" : "Bad Request",
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as unknown as Response;
}

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

async function withFetch(
  responses: Response[],
  run: () => Promise<void>,
): Promise<{ calls: number }> {
  const realFetch = globalThis.fetch;
  const calls = { count: 0 };
  globalThis.fetch = (async () => {
    const response = responses[Math.min(calls.count, responses.length - 1)];
    calls.count += 1;
    return response;
  }) as typeof globalThis.fetch;
  try {
    await run();
  } finally {
    globalThis.fetch = realFetch;
  }
  return { calls: calls.count };
}

test("linearBackoff grows linearly, not exponentially", () => {
  assert.equal(linearBackoff(0), 1000);
  assert.equal(linearBackoff(1), 2000);
  assert.equal(linearBackoff(2), 3000);
  assert.equal(linearBackoff(0, 250), 250);
  assert.equal(linearBackoff(3, 250), 1000);
});

test("rpcFetch retries a 429 and resolves on the next attempt", async () => {
  const timer = recordDelays();
  try {
    const { calls } = await withFetch(
      [jsonResponse(429, {}), jsonResponse(200, { result: { height: 7 } })],
      async () => {
        const result = await rpcFetch<{ height: number }>(
          NODE,
          { method: "status", params: [] },
          { baseDelay: 1 },
        );
        assert.deepEqual(result, { height: 7 });
      },
    );
    assert.equal(calls, 2);
    assert.deepEqual(timer.delays, [1]);
  } finally {
    timer.restore();
  }
});

test("rpcFetch retries a 429 exactly maxRetries times with 1s/2s/3s backoff", async () => {
  const timer = recordDelays();
  try {
    const { calls } = await withFetch([jsonResponse(429, {})], async () => {
      await assert.rejects(
        rpcFetch(NODE, { method: "status", params: [] }, { maxRetries: 3 }),
        /^Error: HTTP 429: Too Many Requests$/,
      );
    });
    assert.equal(calls, 4);
    assert.deepEqual(timer.delays, [1000, 2000, 3000]);
  } finally {
    timer.restore();
  }
});

test("rpcFetch honours maxRetries: 0", async () => {
  const timer = recordDelays();
  try {
    const { calls } = await withFetch([jsonResponse(429, {})], async () => {
      await assert.rejects(
        rpcFetch(NODE, { method: "status", params: [] }, { maxRetries: 0 }),
        /HTTP 429/,
      );
    });
    assert.equal(calls, 1);
    assert.deepEqual(timer.delays, []);
  } finally {
    timer.restore();
  }
});

test("rpcFetch does not retry a non-429 http failure", async () => {
  const timer = recordDelays();
  try {
    const { calls } = await withFetch([jsonResponse(400, {})], async () => {
      await assert.rejects(
        rpcFetch(NODE, { method: "status", params: [] }, { baseDelay: 1 }),
        /HTTP 400/,
      );
    });
    assert.equal(calls, 1);
    assert.deepEqual(timer.delays, []);
  } finally {
    timer.restore();
  }
});

test("rpcFetch does not retry a JSON-RPC error body", async () => {
  const timer = recordDelays();
  try {
    const { calls } = await withFetch(
      [jsonResponse(200, { error: { data: "account does not exist" } })],
      async () => {
        await assert.rejects(
          rpcFetch(NODE, { method: "query", params: {} }, { baseDelay: 1 }),
          (error: unknown) => {
            assert.ok(error instanceof RpcResponseError);
            assert.equal(error.message, "account does not exist");
            return true;
          },
        );
      },
    );
    assert.equal(calls, 1);
    assert.deepEqual(timer.delays, []);
  } finally {
    timer.restore();
  }
});

test("rpcFetch posts a jsonrpc 2.0 envelope and returns result", async () => {
  const realFetch = globalThis.fetch;
  let sent: { url: string; init: RequestInit } | null = null;
  globalThis.fetch = (async (url: unknown, init: unknown) => {
    sent = { url: String(url), init: init as RequestInit };
    return jsonResponse(200, { result: [104, 105] });
  }) as typeof globalThis.fetch;
  try {
    const result = await rpcFetch<number[]>(NODE, {
      method: "query",
      params: { request_type: "view_account" },
    });
    assert.deepEqual(result, [104, 105]);
    assert.equal(sent!.url, NODE);
    assert.equal(sent!.init.method, "POST");
    assert.deepEqual(JSON.parse(String(sent!.init.body)), {
      jsonrpc: "2.0",
      id: "dontcare",
      method: "query",
      params: { request_type: "view_account" },
    });
  } finally {
    globalThis.fetch = realFetch;
  }
});
