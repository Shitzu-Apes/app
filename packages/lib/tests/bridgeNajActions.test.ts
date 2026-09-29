import {
  actionCreators,
  najActionToInternal,
} from "@near-wallet-selector/core";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { withNajActions } from "../src/bridge/omni.ts";

// The bridge SDK builds NEAR transactions in the internal action shape and hands
// them to signAndSendTransactions, which near-wallet-selector defines in NAJ
// terms. Intear converts each action with najActionToInternal and threw
// "Unsupported NAJ action", so every NEAR deposit failed at signing.

/** The internal shape omni-bridge-sdk emits (clients/near-wallet-selector.js). */
const internalDeposit = {
  type: "FunctionCall" as const,
  params: {
    methodName: "ft_transfer_call",
    args: new TextEncoder().encode(JSON.stringify({ receiver_id: "locker" })),
    gas: "30000000000000",
    deposit: "1",
  },
};

const internalStorageDeposit = {
  type: "FunctionCall" as const,
  params: {
    methodName: "storage_deposit",
    args: new TextEncoder().encode(JSON.stringify({})),
    gas: "30000000000000",
    deposit: "1250000000000000000000",
  },
};

type Seen = { type?: string; params?: { methodName?: string } };

/** A selector stub whose wallet behaves like Intear's signAndSendTransactions. */
function strictSelector() {
  const seen: Seen[] = [];
  const selector = {
    async wallet() {
      return {
        id: "intear-wallet",
        async signAndSendTransactions({
          transactions,
        }: {
          transactions: { actions: unknown[] }[];
        }) {
          for (const tx of transactions) {
            // Verbatim from intear-wallet/index.js:5721.
            for (const action of tx.actions) {
              seen.push(najActionToInternal(action as never) as Seen);
            }
          }
          return transactions;
        },
      };
    },
  };
  return { selector, seen };
}

const send = (selector: { wallet(): Promise<any> }, actions: unknown[]) =>
  selector
    .wallet()
    .then((wallet) =>
      wallet.signAndSendTransactions({ transactions: [{ actions }] }),
    );

test("an unwrapped SDK transaction is rejected, which is the reported bug", async () => {
  // Guards the premise. If this ever stops rejecting, either the SDK fixed
  // itself or near-wallet-selector relaxed, and the wrapper can be revisited.
  const { selector } = strictSelector();
  await assert.rejects(
    () => send(selector, [internalDeposit]),
    /Unsupported NAJ action/,
  );
});

test("the wrapper converts the SDK's internal actions to NAJ", async () => {
  const { selector, seen } = strictSelector();
  const wrapped = withNajActions(selector as never);

  await wrapped.wallet().then((wallet) =>
    wallet.signAndSendTransactions({
      transactions: [{ actions: [internalDeposit, internalStorageDeposit] }],
    }),
  );

  assert.equal(seen.length, 2);
  for (const action of seen) {
    assert.equal(action.type, "FunctionCall");
  }
  assert.equal(seen[0].params?.methodName, "ft_transfer_call");
  assert.equal(seen[1].params?.methodName, "storage_deposit");
});

test("actions that are already NAJ are passed through untouched", async () => {
  // The app supplies additionalTransactions built with actionCreators, which is
  // already NAJ. Converting those again would throw, because a NAJ action has
  // no `type` key, and the SDK puts them in the same array as its own.
  const { selector, seen } = strictSelector();
  const najAction = actionCreators.functionCall("near_deposit", {}, 30n, 1n);
  const wrapped = withNajActions(selector as never);

  await wrapped.wallet().then((wallet) =>
    wallet.signAndSendTransactions({
      transactions: [{ actions: [najAction, internalDeposit] }],
    }),
  );

  assert.equal(seen.length, 2, "both actions must survive");
  assert.equal(seen[0].type, "FunctionCall");
  assert.equal(seen[0].params?.methodName, "near_deposit");
  assert.equal(seen[1].params?.methodName, "ft_transfer_call");
});

test("the wrapper leaves the rest of the selector alone", async () => {
  const selector = {
    isSignedIn: () => true,
    options: { network: { networkId: "mainnet" } },
    async wallet() {
      return { id: "x" };
    },
  };
  const wrapped = withNajActions(selector as never);
  assert.equal(wrapped.isSignedIn(), true);
  assert.equal(wrapped.options.network.networkId, "mainnet");
});

test("a null wallet is passed through", async () => {
  const wrapped = withNajActions({
    async wallet() {
      return null;
    },
  } as never);
  assert.equal(await wrapped.wallet(), null);
});

test("the bridge wraps the selector it hands to the SDK", () => {
  // Source guard so the wrapper cannot be dropped from the deposit path.
  const page = readFileSync("src/bridge/NativeBridgePanel.svelte", "utf8");
  assert.match(
    page,
    /getClient\(ChainKind\.Near, withNajActions\(selector\)\)/,
  );
});
