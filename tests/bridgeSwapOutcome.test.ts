import assert from "node:assert/strict";
import test from "node:test";

import {
  nativeBalanceOf,
  parseEvent,
  receivedInTransaction,
  tokenBalanceOf,
} from "../src/lib/near/swapOutcome.ts";

// The balance delta this replaced reported a successful swap as having delivered
// nothing, because the swap had produced native NEAR and the balance being sampled
// was the wrapped contract's. Reading the transaction says what moved, in what form,
// and attributes it to that transaction and nothing else.

const ACC = "marior.near";
const WRAP = "wrap.near";

const originalFetch = globalThis.fetch;

const ft = (newOwner: string, amount: string, token = WRAP) =>
  JSON.stringify({
    event_type: "ft_transfer",
    token_id: token,
    old_owner_id: "dex.intear.near",
    new_owner_id: newOwner,
    amount,
    memo: null,
  });

const native = (newAccount: string, amount: string) =>
  JSON.stringify({
    event_type: "transfer",
    old_account_id: "dex.intear.near",
    new_account_id: newAccount,
    amount,
  });

test("an NEP-141 credit is read, in the token's own units", () => {
  const event = parseEvent(ft(ACC, "203566000000000000000000"), ACC);
  assert.equal(event?.kind, "token");
  assert.equal(event?.kind === "token" && event.tokenId, WRAP);
  assert.equal(
    event?.kind === "token" && event.amount,
    "203566000000000000000000",
  );
});

test("a native NEAR credit is read, and is not a token credit", () => {
  // The distinction the whole change exists for: the two are not interchangeable and
  // adding them would produce a number that belongs to nothing.
  const event = parseEvent(native(ACC, "203566000000000000000000"), ACC);
  assert.equal(event?.kind, "native");
});

test("a transfer that credited someone else is not ours", () => {
  // A swap moves tokens through the pool on the way, and those lines are the same
  // shape. Counting them would report the swap's own intermediate hops as output.
  assert.equal(parseEvent(ft("dex.intear.near", "500000"), ACC), null);
  assert.equal(parseEvent(native("dex.intear.near", "500000"), ACC), null);
});

test("an unrelated receipt line is ignored rather than throwing", () => {
  // A swap emits plenty of logs that are not transfers, and some are not JSON.
  assert.equal(parseEvent("Not a JSON line", ACC), null);
  assert.equal(parseEvent('{"event_type":"ft_metadata"}', ACC), null);
  assert.equal(parseEvent("{}", ACC), null);
});

/** A fake NEAR RPC that answers `tx` with a whole result body. */
function stubTxRaw(result: Record<string, unknown>) {
  const original = originalFetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ jsonrpc: "2.0", id: "dontcare", result }), {
      status: 200,
    })) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

/** A fake NEAR RPC that answers `tx` with the given log lines. */
function stubTx(logs: string[]) {
  const original = originalFetch;
  // A JSON-RPC envelope, because `rpcFetch` unwraps `result` itself.
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: "dontcare",
        result: {
          transaction: { hash: "abc" },
          transaction_outcome: { outcome: { logs: [] } },
          receipts_outcome: [{ id: "Success", outcome: { logs } }],
        },
      }),
      { status: 200 },
    )) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

test("a wrapped delivery is summed from the receipts", async () => {
  const restore = stubTx([
    ft("dex.intear.near", "111"),
    ft(ACC, "100"),
    ft(ACC, "103566000000000000000000"),
    ft("someone.else.near", "999999"),
  ]);
  try {
    const { tokens, native: got } = await receivedInTransaction("abc", ACC);
    assert.equal(got, null, "no native credit, so none is reported");
    assert.equal(tokens.get(WRAP)?.amount, 100n + 103566000000000000000000n);
  } finally {
    restore();
  }
});

test("a native delivery is reported as native, not as the rail", async () => {
  // The case that broke the balance delta: nothing arrived in `wrap.near`, so the
  // delta was zero, and a successful swap was reported as delivering nothing.
  const restore = stubTx([
    native("dex.intear.near", "50"),
    native(ACC, "203566000000000000000000"),
  ]);
  try {
    const { native: got, tokens } = await receivedInTransaction("abc", ACC);
    assert.equal(got?.amount, 203566000000000000000000n);
    assert.equal(got?.native, true);
    assert.equal(tokens.size, 0, "no NEP-141 credit at all");
  } finally {
    restore();
  }
});

test("a swap that moved nothing reports nothing, rather than a zero", async () => {
  const restore = stubTx([
    ft("dex.intear.near", "500"),
    native("dex.intear.near", "500"),
  ]);
  try {
    const { native: got, tokens } = await receivedInTransaction("abc", ACC);
    assert.equal(got, null);
    assert.equal(tokens.size, 0);
  } finally {
    restore();
  }
});

test("zero-value credits are not counted", async () => {
  const restore = stubTx([ft(ACC, "0"), native(ACC, "0")]);
  try {
    const { native: got, tokens } = await receivedInTransaction("abc", ACC);
    assert.equal(got, null);
    assert.equal(tokens.size, 0);
  } finally {
    restore();
  }
});

// A reverting call emits no events, so the log list is empty. The reason is not.

test("a revert is read out of the receipt, with its reason", () => {
  // The transaction this came from: `wrap.near::near_withdraw` panicked with
  // "The account doesn't have enough balance". Its receipts carry no logs at all,
  // because a panicking call emits no events — so a reader that only parses logs
  // concludes the swap delivered nothing, when in fact it failed and said why.
  // The real shape, nesting included: an action failure wraps its cause under
  // `ActionError`, so a reader that looks for `Failure.kind` finds nothing and
  // silently reports a generic revert instead of the panic.
  const failure = {
    ActionError: {
      index: 0,
      kind: {
        FunctionCallError: {
          ExecutionError:
            "Smart contract panicked: The account doesn't have enough balance",
        },
      },
    },
  };
  const restore = stubTxRaw({
    status: { Failure: failure },
    receipts_outcome: [
      { outcome: { logs: [], status: { Failure: failure } } },
      { outcome: { logs: [], status: { SuccessValue: "" } } },
    ],
  });
  try {
    return receivedInTransaction("abc", ACC).then((result) => {
      assert.equal(
        result.reverted,
        "Smart contract panicked: The account doesn't have enough balance",
      );
      // And nothing arrived, which is the point: the two facts go together.
      assert.equal(result.native, null);
      assert.equal(result.tokens.size, 0);
    });
  } finally {
    restore();
  }
});

test("a successful transaction reports no revert", () => {
  const restore = stubTxRaw({
    status: { SuccessValue: "" },
    receipts_outcome: [
      { outcome: { logs: [ft(ACC, "100")], status: { SuccessValue: "" } } },
    ],
  });
  try {
    return receivedInTransaction("abc", ACC).then((result) => {
      assert.equal(result.reverted, undefined);
      assert.equal(result.tokens.get(WRAP)?.amount, 100n);
    });
  } finally {
    restore();
  }
});

test("a revert with no message still reports that it reverted", () => {
  // "the transaction reverted" is a real answer; an empty string would read as
  // "nothing went wrong".
  const restore = stubTxRaw({
    // The nesting is present but carries no message, which is a real shape.
    status: { Failure: { ActionError: { index: 2 } } },
    receipts_outcome: [],
  });
  try {
    return receivedInTransaction("abc", ACC).then((result) => {
      assert.equal(result.reverted, "the transaction reverted");
    });
  } finally {
    restore();
  }
});

// Every account read is a *query*. These pin the payload, because a read that asks
// for `view_account` as a method of its own returns METHOD_NOT_FOUND, which is
// indistinguishable from a broken node and was mistaken for one here.

test("native balance asks for a view_account query, not a bare method", async () => {
  const seen: { method?: string; params?: Record<string, unknown> }[] = [];
  globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
    seen.push(JSON.parse(String(init?.body ?? "{}")));
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: "dontcare",
        result: { amount: "309493873020092343045602810" },
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  try {
    assert.equal(await nativeBalanceOf(ACC), 309493873020092343045602810n);
    assert.equal(seen.length, 1);
    assert.equal(seen[0]?.method, "query");
    assert.equal(seen[0]?.params?.request_type, "view_account");
    assert.equal(seen[0]?.params?.account_id, ACC);
    assert.ok(seen[0]?.params?.finality, "finality is required by the query");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a token balance asks for a call_function query with the account base64-encoded", async () => {
  const seen: { method?: string; params?: Record<string, unknown> }[] = [];
  globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
    seen.push(JSON.parse(String(init?.body ?? "{}")));
    const balance = JSON.stringify("1000000")
      .split("")
      .map((c) => c.charCodeAt(0));
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: "dontcare",
        result: { result: balance },
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  try {
    assert.equal(await tokenBalanceOf(WRAP, ACC), 1000000n);
    const params = seen[0]?.params;
    assert.equal(seen[0]?.method, "query");
    assert.equal(params?.request_type, "call_function");
    assert.equal(params?.account_id, WRAP);
    assert.equal(params?.method_name, "ft_balance_of");
    assert.equal(
      Buffer.from(String(params?.args_base64), "base64").toString(),
      JSON.stringify({ account_id: ACC }),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an unregistered token is zero, not an error", async () => {
  // The normal state before a first swap into a token you hold none of, and the
  // difference has to be right in exactly that case.
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: "dontcare",
        error: { name: "HANDLER_ERROR", cause: { name: "CONTRACT_NOT_FOUND" } },
      }),
      { status: 200 },
    )) as typeof fetch;
  try {
    assert.equal(await tokenBalanceOf("never.held.near", ACC), 0n);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an unreadable native balance is an error, not a silent zero", async () => {
  // Substituting zero for a node that could not answer would turn a failed read
  // into a fabricated gain or loss in the caller's difference.
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({ jsonrpc: "2.0", id: "dontcare", result: {} }),
      { status: 200 },
    )) as typeof fetch;
  try {
    await assert.rejects(() => nativeBalanceOf(ACC));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
