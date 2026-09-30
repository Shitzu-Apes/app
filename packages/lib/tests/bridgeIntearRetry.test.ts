import assert from "node:assert/strict";
import test from "node:test";

process.env.VITE_NETWORK_ID = "mainnet";

const {
  getIntearRoutes,
  getIntearRoutesRouted,
  IntearError,
  MAX_RETRY_AFTER_MS,
  parseRetryAfter,
  rateLimitWaitMs,
} = await import("../src/near/intear.ts");

// The router is flaky, and the search was persistent about it while the execution
// was not. These pin the shared behaviour, and the count, that both now rely on.
//
// It fails in two different ways and they are retried differently: an empty list,
// which is ambiguous and waited out, and a 429, which carries the server's own
// `Retry-After` and is re-asked when it says.

const QUERY = {
  tokenIn: "wrap.near",
  tokenOut: "token.0xshitzu.near",
  amountIn: 10n ** 24n,
  traderAccountId: "alice.near",
};

/** A 200 route list, or a raw response when the status itself is the case. */
type Answer = unknown[] | Response;

function stubRouter(answers: Answer[]) {
  const original = globalThis.fetch;
  let call = 0;
  globalThis.fetch = (async () => {
    const answer = answers[Math.min(call, answers.length - 1)];
    call++;
    // Cloned, because a list shorter than the calls made repeats its last answer
    // and a Response body can only be read once.
    return answer instanceof Response
      ? answer.clone()
      : new Response(JSON.stringify(answer), { status: 200 });
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

// The rate limit, which is the other half of "the router did not answer".

test("reads Retry-After in seconds, as a date, or not at all", () => {
  assert.equal(parseRetryAfter("5"), 5_000);
  // "Retry now" is a real instruction and must not be confused with "no hint",
  // which falls back to our own one-second wait.
  assert.equal(parseRetryAfter("0"), 0);
  assert.equal(parseRetryAfter(null), undefined);
  assert.equal(parseRetryAfter("  "), undefined);
  assert.equal(parseRetryAfter("soon"), undefined);
  // A date already in the past is nothing to honour, not a negative wait.
  assert.equal(
    parseRetryAfter(new Date(Date.now() - 1_000).toUTCString()),
    undefined,
  );

  const inTwoSeconds = new Date(Date.now() + 2_000).toUTCString();
  const dated = parseRetryAfter(inTwoSeconds);
  assert.ok(
    dated !== undefined && dated > 500 && dated <= 2_000,
    `the date form gave ${dated}`,
  );
});

test("a Retry-After long enough to hang the page is capped", () => {
  // The server named five seconds live. A header naming an hour must not hold a
  // form or a signed transfer for an hour.
  assert.equal(parseRetryAfter("3600"), MAX_RETRY_AFTER_MS);
  assert.equal(
    parseRetryAfter(new Date(Date.now() + 3_600_000).toUTCString()),
    MAX_RETRY_AFTER_MS,
  );
});

test("a rate-limited answer carries the hint on the error", async () => {
  const stub = stubRouter([
    new Response("Rate limit exceeded, retry in 5s or use an API key", {
      status: 429,
      headers: { "retry-after": "5" },
    }),
  ]);
  try {
    await assert.rejects(
      () => getIntearRoutes(QUERY),
      (err: unknown) =>
        err instanceof IntearError &&
        err.status === 429 &&
        err.retryAfterMs === 5_000,
    );
  } finally {
    stub.restore();
  }
});

/** The router's own refusal, with the header it actually sends. */
const rateLimited = (retryAfter?: string) =>
  new Response("Rate limit exceeded, retry in 5s or use an API key", {
    status: 429,
    headers: retryAfter === undefined ? {} : { "retry-after": retryAfter },
  });

test("a rate-limited request is asked again instead of failing the leg", async () => {
  // The reported failure: the router refuses with a 429 and the caller sees an
  // error, because only empty answers were ever retried.
  const stub = stubRouter([rateLimited(), [route("100")]]);
  const realRandom = Math.random;
  Math.random = () => 0;
  const started = Date.now();
  try {
    const routes = await getIntearRoutesRouted(QUERY);
    assert.equal(routes.length, 1);
    assert.equal(stub.calls(), 2);
    // No header on this one, so the fallback schedule's first wait applies
    // rather than a re-ask against a bucket that is still empty.
    assert.ok(Date.now() - started >= 900, "the retry did not wait");
  } finally {
    Math.random = realRandom;
    stub.restore();
  }
});

test("the server's Retry-After is used instead of our own schedule", async () => {
  const stub = stubRouter([rateLimited("0"), [route("100")]]);
  const realRandom = Math.random;
  Math.random = () => 0;
  const started = Date.now();
  try {
    assert.equal((await getIntearRoutesRouted(QUERY)).length, 1);
    assert.equal(stub.calls(), 2);
    // "Retry now" must not be rounded up to the one-second fallback.
    assert.ok(Date.now() - started < 500, "the header was not honoured");
  } finally {
    Math.random = realRandom;
    stub.restore();
  }
});

test("a rate limit is retried even when the empty-answer budget is one", async () => {
  // This is the search: it spends a single attempt on an empty answer, because an
  // empty is ambiguous. That count must not take the rate-limit retry down with
  // it, which is the bug this pins.
  const stub = stubRouter([rateLimited("0"), [route("100")]]);
  const realRandom = Math.random;
  Math.random = () => 0;
  try {
    const routes = await getIntearRoutesRouted(QUERY, {
      attempts: 1,
      backoffMs: [],
    });
    assert.equal(routes.length, 1);
    assert.equal(stub.calls(), 2);
  } finally {
    Math.random = realRandom;
    stub.restore();
  }
});

test("an empty answer and a rate limit are counted separately", async () => {
  // The two budgets compose rather than share: the 429 is re-asked, then the
  // empty is re-asked, and the route on the third answer is still found.
  const stub = stubRouter([rateLimited("0"), [], [route("100")]]);
  const realRandom = Math.random;
  Math.random = () => 0;
  try {
    const routes = await getIntearRoutesRouted(QUERY, { backoffMs: [] });
    assert.equal(routes.length, 1);
    assert.equal(stub.calls(), 3);
  } finally {
    Math.random = realRandom;
    stub.restore();
  }
});

test("rate-limit waits grow linearly, and the server's hint outranks them", () => {
  // No hint: before the second ask, the third, the fourth — 1s, 2s, 3s.
  assert.equal(rateLimitWaitMs(1), 1_000);
  assert.equal(rateLimitWaitMs(2), 2_000);
  assert.equal(rateLimitWaitMs(3), 3_000);
  // A hint is used verbatim when there is one, longer or shorter, because it is
  // the server saying when it will be ready rather than our guess at it.
  assert.equal(rateLimitWaitMs(1, 5_000), 5_000);
  assert.equal(rateLimitWaitMs(2, 5_000), 5_000);
  assert.equal(rateLimitWaitMs(1, 0), 0);
  // The step is a parameter so a test can watch the schedule without paying it.
  assert.equal(rateLimitWaitMs(2, undefined, 10), 20);
});

test("rate-limited retries wait longer each time when no hint is sent", async () => {
  // The schedule the router gets when it does not say when to come back. The
  // step is small here only so the test does not pay the real one.
  const stub = stubRouter([rateLimited()]);
  const realRandom = Math.random;
  Math.random = () => 0;
  const started = Date.now();
  try {
    await assert.rejects(
      () =>
        getIntearRoutesRouted(QUERY, {
          rateLimitAttempts: 3,
          rateLimitBaseMs: 100,
        }),
      (err: unknown) => err instanceof IntearError && err.status === 429,
    );
    assert.equal(stub.calls(), 3);
    // 100ms then 200ms, so the second wait is longer than the first.
    assert.ok(Date.now() - started >= 290, "the retries did not wait longer");
  } finally {
    Math.random = realRandom;
    stub.restore();
  }
});

test("only a rate limit is retried; other failures surface at once", async () => {
  // A 400 is a bug in our query, not a fact about the moment, and re-asking it
  // would only add a second of waiting to an error the user has to see.
  const stub = stubRouter([new Response("bad query", { status: 400 })]);
  try {
    await assert.rejects(
      () => getIntearRoutesRouted(QUERY, { backoffMs: [] }),
      (err: unknown) => err instanceof IntearError && err.status === 400,
    );
    assert.equal(stub.calls(), 1);
  } finally {
    stub.restore();
  }
});

test("a rate limit that persists is reported rather than waited out forever", async () => {
  const stub = stubRouter([rateLimited("0")]);
  try {
    await assert.rejects(
      () =>
        getIntearRoutesRouted(QUERY, {
          rateLimitAttempts: 3,
          rateLimitBaseMs: 0,
        }),
      (err: unknown) => err instanceof IntearError && err.status === 429,
    );
    assert.equal(stub.calls(), 3);
  } finally {
    stub.restore();
  }
});

test("an aborted request does not sit out the rate-limit wait", async () => {
  // Retry-After is the longest wait in this file; a superseded search must not
  // hold the page for it.
  const stub = stubRouter([rateLimited("5")]);
  const controller = new AbortController();
  const realRandom = Math.random;
  Math.random = () => 0;
  try {
    setTimeout(() => controller.abort(), 20);
    const started = Date.now();
    await assert.rejects(
      () => getIntearRoutesRouted({ ...QUERY, signal: controller.signal }),
      (err: unknown) => err instanceof IntearError && err.status === 429,
    );
    assert.ok(
      Date.now() - started < 2_000,
      "an aborted request waited out Retry-After",
    );
  } finally {
    Math.random = realRandom;
    stub.restore();
  }
});
