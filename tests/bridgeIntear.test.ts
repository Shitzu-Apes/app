import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRouteQuery,
  describeRouteDexes,
  executableRoutes,
  getIntearRoutes,
  IntearError,
  normalizeTokenId,
  routeAmounts,
  routeToNajTransactions,
  selectBestRoute,
  type IntearRoute,
} from "../src/lib/near/intear.ts";

const b64 = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString("base64");

function makeRoute(overrides: Partial<IntearRoute> = {}): IntearRoute {
  return {
    deadline: null,
    has_slippage: true,
    estimated_amount: { amount_out: "1000" },
    worst_case_amount: { amount_out: "900" },
    dex_id: "Rhea",
    execution_instructions: [
      {
        NearTransaction: {
          receiver_id: "v2.ref-finance.near",
          actions: [
            {
              FunctionCall: {
                method_name: "ft_transfer_call",
                args: b64({
                  receiver_id: "alice.near",
                  amount: "1000",
                  msg: "{}",
                }),
                gas: "30000000000000",
                deposit: "1",
              },
            },
          ],
          continue_if_failed: false,
        },
      },
    ],
    token_output: "token.0xshitzu.near",
    ...overrides,
  };
}

// These hit the live Intear router on purpose: the response shape and which
// pairs actually route are exactly what the bridge's rail search depends on.
const live = { skip: !process.env.INTEAR_LIVE };

test("strips the nep141 prefix the API silently rejects", () => {
  // The docs advertise `nep141:` as valid. It returns an empty route list with
  // HTTP 200 for every pair, which is indistinguishable from no liquidity.
  assert.equal(
    normalizeTokenId("nep141:usdt.tether-token.near"),
    "usdt.tether-token.near",
  );
  assert.equal(
    normalizeTokenId("rhea-nep141: usdt.tether-token.near"),
    "usdt.tether-token.near",
  );
  assert.equal(normalizeTokenId("near"), "near");
  assert.equal(normalizeTokenId(" wrap.near "), "wrap.near");
});

test("always sends max_wait_ms, which has no default", () => {
  const query = buildRouteQuery({
    tokenIn: "usdt.tether-token.near",
    tokenOut: "wrap.near",
    amountIn: 1_000n,
    traderAccountId: "alice.near",
  });
  assert.equal(query.get("max_wait_ms"), "1000");
  assert.equal(query.get("amount_in"), "1000");
  assert.equal(query.get("trader_account_id"), "alice.near");
});

test("always sends the trader account, without which routes lose their deposit", () => {
  // A Wrap route requested without trader_account_id comes back with no
  // near_deposit action, so the swap would be signed but never funded.
  const query = buildRouteQuery({
    tokenIn: "near",
    tokenOut: "wrap.near",
    amountIn: 1n,
    traderAccountId: "alice.near",
  });
  assert.ok(query.get("trader_account_id"));
});

test("normalises both sides of the pair", () => {
  const query = buildRouteQuery({
    tokenIn: "nep141:wrap.near",
    tokenOut: "nep141:token.0xshitzu.near",
    amountIn: 1n,
    traderAccountId: "alice.near",
  });
  assert.equal(query.get("token_in"), "wrap.near");
  assert.equal(query.get("token_out"), "token.0xshitzu.near");
});

test("omits dexes and referrer when not asked for", () => {
  const bare = buildRouteQuery({
    tokenIn: "wrap.near",
    tokenOut: "token.0xshitzu.near",
    amountIn: 1n,
    traderAccountId: "alice.near",
  });
  assert.equal(bare.get("dexes"), null);
  assert.equal(bare.get("referrer_id"), null);

  const full = buildRouteQuery({
    tokenIn: "wrap.near",
    tokenOut: "token.0xshitzu.near",
    amountIn: 1n,
    traderAccountId: "alice.near",
    dexes: ["Rhea", "Wrap"],
    referrerId: "intear.near",
  });
  assert.equal(full.get("dexes"), "Rhea,Wrap");
  assert.equal(full.get("referrer_id"), "intear.near");
});

test("ranks on the guaranteed floor, not the estimate", () => {
  // A route that looks better on paper but guarantees less must not win.
  const greedy = makeRoute({
    dex_id: "Greedy",
    estimated_amount: { amount_out: "5000" },
    worst_case_amount: { amount_out: "100" },
  });
  const honest = makeRoute({
    dex_id: "Honest",
    estimated_amount: { amount_out: "1000" },
    worst_case_amount: { amount_out: "900" },
  });
  assert.equal(selectBestRoute([greedy, honest])?.dex_id, "Honest");
  assert.equal(selectBestRoute([honest, greedy])?.dex_id, "Honest");
});

test("an empty route list selects nothing rather than throwing", () => {
  assert.equal(selectBestRoute([]), undefined);
});

test("reads amounts as bigints", () => {
  const { estimatedOut, worstCaseOut } = routeAmounts(
    makeRoute({
      estimated_amount: { amount_out: "123456789012345678901234567890" },
      worst_case_amount: { amount_out: "1" },
    }),
  );
  assert.equal(typeof estimatedOut, "bigint");
  assert.equal(estimatedOut, 123456789012345678901234567890n);
  assert.equal(worstCaseOut, 1n);
});

test("drops NEAR Intents routes instead of half-executing them", () => {
  const intents = makeRoute({
    dex_id: "NearIntents",
    execution_instructions: [
      { IntentsQuote: { message_to_sign: {}, quote_hash: "abc" } },
    ],
  });
  const near = makeRoute({ dex_id: "Rhea" });
  assert.deepEqual(
    executableRoutes([intents, near]).map((r) => r.dex_id),
    ["Rhea"],
  );
});

/**
 * `actionCreators.functionCall` JSON-serialises `args` into a Buffer, which is
 * what the wallet selector ends up sending. Round-trip it so the assertions read
 * against the arguments the router actually meant to pass.
 */
function callArgs(action: unknown): Record<string, unknown> {
  const { functionCall } = action as {
    functionCall: { args: Buffer | string };
  };
  const { args } = functionCall;
  return JSON.parse(
    typeof args === "string" ? args : new TextDecoder().decode(args),
  ) as Record<string, unknown>;
}

test("decodes base64 args into NAJ function calls", () => {
  const txs = routeToNajTransactions(makeRoute());
  assert.equal(txs.length, 1);
  assert.equal(txs[0].receiverId, "v2.ref-finance.near");
  assert.equal(txs[0].actions.length, 1);
  const action = txs[0].actions[0] as {
    functionCall: { methodName: string; gas: bigint; deposit: bigint };
  };
  assert.equal(action.functionCall.methodName, "ft_transfer_call");
  assert.equal(callArgs(action).receiver_id, "alice.near");
  assert.equal(action.functionCall.gas, 30_000_000_000_000n);
  assert.equal(action.functionCall.deposit, 1n);
});

test("keeps each instruction as its own transaction, in order", () => {
  // A real route is near_deposit then ft_transfer_call. Merging them into one
  // transaction, or reversing them, breaks the swap.
  const txs = routeToNajTransactions(
    makeRoute({
      execution_instructions: [
        {
          NearTransaction: {
            receiver_id: "wrap.near",
            actions: [
              {
                FunctionCall: {
                  method_name: "near_deposit",
                  args: b64({}),
                  gas: "2000000000000",
                  deposit: "100000000000000000000000",
                },
              },
            ],
          },
        },
        {
          NearTransaction: {
            receiver_id: "v2.ref-finance.near",
            actions: [
              {
                FunctionCall: {
                  method_name: "ft_transfer_call",
                  args: b64({ amount: "1" }),
                  gas: "150000000000000",
                  deposit: "1",
                },
              },
            ],
          },
        },
      ],
    }),
  );
  assert.equal(txs.length, 2);
  assert.equal(txs[0].receiverId, "wrap.near");
  assert.equal(txs[1].receiverId, "v2.ref-finance.near");
});

test("unwraps a double-encoded args string", () => {
  // Some DEXes base64 a JSON string containing JSON, not a JSON object.
  const txs = routeToNajTransactions(
    makeRoute({
      execution_instructions: [
        {
          NearTransaction: {
            receiver_id: "dex.intear.near",
            actions: [
              {
                FunctionCall: {
                  method_name: "swap",
                  args: Buffer.from(
                    JSON.stringify(JSON.stringify({ a: 1 })),
                  ).toString("base64"),
                  gas: "1",
                  deposit: "0",
                },
              },
            ],
          },
        },
      ],
    }),
  );
  assert.equal(txs.length, 1);
  assert.deepEqual(callArgs(txs[0].actions[0]), { a: 1 });
});

test("an Intents-only route yields no transactions rather than bad ones", () => {
  assert.deepEqual(
    routeToNajTransactions(
      makeRoute({
        execution_instructions: [
          { IntentsQuote: { message_to_sign: {}, quote_hash: "abc" } },
        ],
      }),
    ),
    [],
  );
});

test("names the dexes behind a route for the readout", () => {
  assert.equal(
    describeRouteDexes([
      makeRoute({ dex_id: "Rhea" }),
      makeRoute({ dex_id: "Plach" }),
    ]),
    "Rhea → Plach",
  );
});

test("a malformed response is an error, not an empty route list", () => {
  // `[]` means no liquidity. An object means we are talking to something that is
  // not the router, and reporting "no route" there would hide a real outage.
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("{}", { status: 200 })) as typeof fetch;
  return getIntearRoutes({
    tokenIn: "wrap.near",
    tokenOut: "token.0xshitzu.near",
    amountIn: 1n,
    traderAccountId: "alice.near",
  })
    .then(
      () => assert.fail("expected a rejection"),
      (err: unknown) => assert.ok(err instanceof IntearError),
    )
    .finally(() => {
      globalThis.fetch = original;
    });
});

test("an empty array is a valid answer meaning no liquidity", () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response("[]", { status: 200 })) as typeof fetch;
  return getIntearRoutes({
    tokenIn: "wrap.near",
    tokenOut: "token.0xshitzu.near",
    amountIn: 1n,
    traderAccountId: "alice.near",
  })
    .then((routes) => assert.deepEqual(routes, []))
    .finally(() => {
      globalThis.fetch = original;
    });
});

test("live: wNEAR routes to SHITZU on Rhea", live, async () => {
  const routes = await getIntearRoutes({
    tokenIn: "wrap.near",
    tokenOut: "token.0xshitzu.near",
    amountIn: 10n ** 24n,
    traderAccountId: "shitzu.sputnik-dao.near",
  });
  assert.ok(routes.length > 0, "expected at least one route");
  const best = selectBestRoute(executableRoutes(routes));
  assert.ok(best);
  assert.ok(routeAmounts(best!).worstCaseOut > 0n);
});

test("live: native NEAR wraps 1:1 through the Wrap dex", live, async () => {
  const routes = await getIntearRoutes({
    tokenIn: "near",
    tokenOut: "wrap.near",
    amountIn: 10n ** 24n,
    traderAccountId: "shitzu.sputnik-dao.near",
  });
  const wrap = executableRoutes(routes).find((r) => r.dex_id === "Wrap");
  assert.ok(wrap, "expected a Wrap route");
  assert.equal(routeAmounts(wrap!).estimatedOut, 10n ** 24n);
});

test(
  "live: a token with no liquidity returns an empty list, not an error",
  live,
  async () => {
    const routes = await getIntearRoutes({
      tokenIn: "wrap.near",
      tokenOut: "this.token.does.not.exist.near",
      amountIn: 10n ** 24n,
      traderAccountId: "shitzu.sputnik-dao.near",
    });
    assert.deepEqual(routes, []);
  },
);
