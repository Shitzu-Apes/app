import assert from "node:assert/strict";
import test from "node:test";

process.env.VITE_NETWORK_ID = "mainnet";

const { getIntearRoutesRouted } = await import("../src/lib/near/intear.ts");

// The router is flaky, and the search was persistent about it while the execution
// was not. These pin the shared behaviour, and the count, that both now rely on.

const QUERY = {
  tokenIn: "wrap.near",
  tokenOut: "token.0xshitzu.near",
  amountIn: 10n ** 24n,
  traderAccountId: "alice.near",
};

function stubRouter(bodies: unknown[][]) {
  const original = globalThis.fetch;
  let call = 0;
  globalThis.fetch = (async () => {
    const body = bodies[Math.min(call, bodies.length - 1)];
    call++;
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  return {
    calls: () => call,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

const route = (amountOut: string) => ({
  dex_id: "Rhea",
  estimated_amount: { amount_out: amountOut },
  worst_case_amount: { amount_out: amountOut },
  token_output: "token.0xshitzu.near",
  execution_instructions: [
    { NearTransaction: { receiver_id: "dex.intear.near", actions: [] } },
  ],
});

test("a cold empty answer is re-asked rather than believed", async () => {
  // The measured failure: identical requests, 10–30% of them empty, at any
  // amount. A single empty answer is the router being cold, not the market.
  const stub = stubRouter([[], [], [route("100")]]);
  try {
    const routes = await getIntearRoutesRouted(QUERY, { backoffMs: [] });
    assert.equal(routes.length, 1);
    assert.equal(stub.calls(), 3);
  } finally {
    stub.restore();
  }
});

test("a route on the first answer costs one request", async () => {
  // The common case must not pay for the retry it does not need.
  const stub = stubRouter([[route("100")]]);
  try {
    const routes = await getIntearRoutesRouted(QUERY);
    assert.equal(routes.length, 1);
    assert.equal(stub.calls(), 1);
  } finally {
    stub.restore();
  }
});

test("a pair that genuinely cannot route stops instead of looping", async () => {
  // Empty is also the right answer for a token with no pool, so the retry has to
  // be bounded. Unbounded would turn a dead market into a spinner.
  const stub = stubRouter([[]]);
  try {
    // `backoffMs: []` because the schedule is exercised on its own below; paying
    // five seconds of real waiting to count calls would only slow the suite.
    assert.deepEqual(await getIntearRoutesRouted(QUERY, { backoffMs: [] }), []);
    assert.equal(stub.calls(), 5);
  } finally {
    stub.restore();
  }
});

test("an aborted request stops the loop immediately", async () => {
  // A superseded or unmounted search should not spend the remaining attempts on
  // an answer nobody will read.
  const controller = new AbortController();
  controller.abort();
  const stub = stubRouter([[]]);
  try {
    assert.deepEqual(
      await getIntearRoutesRouted(
        { ...QUERY, signal: controller.signal },
        { backoffMs: [] },
      ),
      [],
    );
    assert.equal(stub.calls(), 1);
  } finally {
    stub.restore();
  }
});

test("the attempt count is adjustable, for a caller that wants one try", async () => {
  const stub = stubRouter([[], [route("100")]]);
  try {
    assert.deepEqual(await getIntearRoutesRouted(QUERY, { attempts: 1 }), []);
    assert.equal(stub.calls(), 1);
  } finally {
    stub.restore();
  }
});

// The delay, which is the part that actually fixes it.

test("retries wait between attempts, because the cold answers come in bursts", async () => {
  // Thirty identical requests fired back to back produced a run of six consecutive
  // empty answers. Three immediate retries all land inside that run and all three
  // fail, which is the reported "it sent empty array multiple times in a row".
  // Spaced 250ms apart, the same router never produced a run longer than two.
  const stub = stubRouter([[], [], [], [], [route("100")]]);
  const started = Date.now();
  const realRandom = Math.random;
  Math.random = () => 0;
  try {
    const routes = await getIntearRoutesRouted(QUERY, { attempts: 5 });
    assert.equal(routes.length, 1);
    assert.equal(stub.calls(), 5);
    // Four backoffs of 500/1000/1500/2000 = 5s, so the retries straddle a cold
    // window rather than sitting inside one.
    assert.ok(Date.now() - started >= 4_900, "the attempts were not spaced");
  } finally {
    Math.random = realRandom;
    stub.restore();
  }
});

test("a route on the first attempt still costs no waiting at all", async () => {
  // The healthy case must not pay for insurance it does not need.
  const stub = stubRouter([[route("100")]]);
  const started = Date.now();
  try {
    assert.equal((await getIntearRoutesRouted(QUERY)).length, 1);
    assert.equal(stub.calls(), 1);
    assert.ok(
      Date.now() - started < 500,
      "no backoff before a first-answer route",
    );
  } finally {
    stub.restore();
  }
});

test("an aborted request does not sit out the backoff", async () => {
  // A superseded search must not hold the page for the remaining seconds.
  const stub = stubRouter([[]]);
  const controller = new AbortController();
  const realRandom = Math.random;
  Math.random = () => 0;
  try {
    // The first answer is empty and the signal trips while the loop would sleep.
    setTimeout(() => controller.abort(), 20);
    const started = Date.now();
    assert.deepEqual(
      await getIntearRoutesRouted({ ...QUERY, signal: controller.signal }),
      [],
    );
    assert.ok(
      Date.now() - started < 2_000,
      "an aborted request waited out the backoff",
    );
  } finally {
    Math.random = realRandom;
    stub.restore();
  }
});
