import assert from "node:assert/strict";
import test from "node:test";

process.env.VITE_NETWORK_ID = "mainnet";

const {
  DETERMINISTIC_REJECTIONS,
  EMPTY_RETRY_DELAYS_MS,
  emptyRetryDelay,
  worthRetryingEmpty,
} = await import("../src/lib/bridge/coldRouter.ts");
// The Intear router answers `[]` for a pair that routes moments later, at 10–30% and
// independently of the amount. Nothing in the response distinguishes that from a
// market with no route, so the caller has to decide from what it already knows.

const rail = (tokenId: string) => ({
  tokenId,
  symbol: tokenId,
  icon: "",
  sourceAddress: tokenId,
  destAddress: tokenId,
  sourceDecimals: 9,
  destDecimals: 9,
});

const empty = (...reasons: string[]) =>
  ({
    plans: [],
    rejected: reasons.map((reason) => ({
      rail: rail("NEAR"),
      reason: reason as never,
    })),
  }) as never;

const withAPlan = (...reasons: string[]) =>
  ({
    plans: [
      {
        kind: "bridge",
        rail: rail("NEAR"),
        sourceSwap: null,
        targetSwap: null,
        bridgedAmount: 1n,
        tokenFee: 0n,
        nativeFee: 0n,
        usdFee: null,
        arrivedAmount: 1n,
        receiveAmount: 1n,
        receiveEstimated: 1n,
        sourceSymbol: "NEAR",
        targetSymbol: "NEAR",
        targetDecimals: 24,
      },
    ],
    rejected: reasons.map((reason) => ({
      rail: rail("NEAR"),
      reason: reason as never,
    })),
  }) as never;

test("a search that found something is never retried", () => {
  assert.equal(worthRetryingEmpty(withAPlan("no-source-route")), false);
});

test("every rail empty for a router reason is retried", () => {
  // Seven rails inside one cold window is one cold window seen seven times. The
  // honest reading is "ask again", not "no route available" — and reporting it as the
  // latter is what makes a live market look dead.
  assert.equal(worthRetryingEmpty(empty("no-source-route")), true);
  assert.equal(
    worthRetryingEmpty(empty("no-source-route", "no-target-route")),
    true,
    "several rails, all of them cold",
  );
});

test("an empty made only of arithmetic or policy is an answer, not a failure", () => {
  // Asking again cannot change either of these, and retrying would add a second of
  // waiting to every "no route" the user is entitled to.
  assert.equal(worthRetryingEmpty(empty("too-small")), false);
  assert.equal(worthRetryingEmpty(empty("no-solana-liquidity")), false);
  assert.equal(
    worthRetryingEmpty(empty("too-small", "no-solana-liquidity")),
    false,
  );
});

test("one router reason among deterministic ones still earns a retry", () => {
  // Most of the rails were rejected on the merits. One was not, and one is enough to
  // say the router might have been cold.
  assert.equal(
    worthRetryingEmpty(
      empty("too-small", "no-solana-liquidity", "no-target-route"),
    ),
    true,
  );
});

test("an empty with no rejections at all is not retried", () => {
  // Nothing to attribute the emptiness to, and the two things that actually produce
  // this are not the Intear router: a superseded search, which re-running would only
  // race, and a same-chain conversion, which is quoted by Jupiter and reported with
  // no rejected rails at all. Retrying either would be a request spent for nothing.
  assert.equal(worthRetryingEmpty({ plans: [], rejected: [] } as never), false);
});

test("the budget is big enough to beat the measured empty rate", () => {
  // The reason this is not two searches. At the measured 10-30% empty rate, two
  // attempts still fail about 9% of the time — roughly one conversion in eleven
  // reported as having no route while the market is open. Five searches put that
  // under one in a thousand, which is the difference between a router that is
  // occasionally wrong and a form that cannot be trusted.
  const rate = 0.3;
  const twoAttempts = rate ** 2;
  const budget = rate ** (EMPTY_RETRY_DELAYS_MS.length + 1);
  assert.ok(twoAttempts > 0.05, "two attempts really do fail 5%+ of the time");
  // 0.3^5 is 0.24% — about one search in four hundred, against one in eleven.
  assert.ok(
    budget < 0.005,
    `the budget fails ${(budget * 100).toFixed(2)}% of the time, under half a percent`,
  );
  assert.ok(
    budget < twoAttempts / 20,
    "and at least twenty times less often than a single re-run",
  );
});

test("each wait grows, so a cold window that survived two is waited out properly", () => {
  assert.ok(
    EMPTY_RETRY_DELAYS_MS.length >= 4,
    "four re-runs, which is what the arithmetic above needs",
  );
  for (let i = 1; i < EMPTY_RETRY_DELAYS_MS.length; i++) {
    assert.ok(
      EMPTY_RETRY_DELAYS_MS[i] > EMPTY_RETRY_DELAYS_MS[i - 1],
      `wait ${i} is longer than wait ${i - 1}`,
    );
  }
  // Spacing is the part that works. Thirty identical requests fired back to back
  // produced six consecutive empties, so an immediate retry is not a retry.
  assert.ok(
    EMPTY_RETRY_DELAYS_MS[0] >= 500,
    "the first re-run is not immediate",
  );
});

test("the waits are jittered, and the jitter is a fraction of the wait", () => {
  // Several people waiting out the same cold window in lockstep is how the burst they
  // are all waiting out gets reproduced.
  for (let i = 0; i < EMPTY_RETRY_DELAYS_MS.length; i++) {
    const base = EMPTY_RETRY_DELAYS_MS[i];
    const samples = new Set(
      Array.from({ length: 40 }, () => emptyRetryDelay(i)),
    );
    assert.ok(samples.size > 1, `wait ${i} is jittered`);
    for (const delay of samples) {
      assert.ok(
        delay >= base && delay < base * 1.35,
        `wait ${i} of ${Math.round(delay)}ms is inside its band`,
      );
    }
  }
});

test("a wait index past the end reuses the last one rather than going undefined", () => {
  const last = EMPTY_RETRY_DELAYS_MS[EMPTY_RETRY_DELAYS_MS.length - 1];
  const delay = emptyRetryDelay(99);
  assert.ok(
    delay >= last && delay < last * 1.35,
    "clamped, so a loop bug cannot wait for NaN milliseconds",
  );
});
