import {
  internalActionToNaj,
  type InternalAction,
} from "@near-wallet-selector/core";
import { OmniBridgeAPI, setConfig, setNetwork } from "omni-bridge-sdk";

import { CHAINS } from "./chains";

import { isReverted, type NearTxOutcome } from "$lib/near/outcome";

const networkId =
  (import.meta.env?.VITE_NETWORK_ID ??
    process.env.VITE_NETWORK_ID ??
    "mainnet") === "mainnet"
    ? "mainnet"
    : "testnet";

/**
 * The SDK keeps its on-chain addresses (lockers, the NEAR bridge contract, the
 * Wormhole program) in module-global state that defaults to mainnet. Without
 * this call only the API base URL was env-switched, so a testnet build would
 * still send deposits to mainnet program ids.
 */
setNetwork(networkId);

/**
 * The SDK hardcodes `rpcUrls: ["https://rpc.near.org"]` and builds a fresh RPC
 * client from that list inside every `viewFunction`, ignoring both the wallet
 * selector and VITE_NODE_URL. Before a NEAR deposit is signed the SDK makes
 * roughly six of those calls (storage_balance_of, the required_balance_for_*
 * set in getBalances), and they all sit between the user's click and the wallet
 * popup. Measured from here, rpc.near.org answers a trivial view call in ~3.1s
 * against ~0.11s for our own node, so the popup opened seconds after the click
 * and the browser blocked it as no longer user-initiated.
 *
 * setConfig is the SDK's own override hook, and VITE_NODE_URL already switches
 * per mode, so this follows the rest of the app.
 */
const nodeUrl = import.meta.env?.VITE_NODE_URL;
if (nodeUrl) {
  setConfig({ near: { rpcUrls: [nodeUrl] } });
}

export const OMNI_API_BASE_URL =
  networkId === "mainnet"
    ? "https://mainnet.api.bridge.nearone.org"
    : "https://testnet.api.bridge.nearone.org";

let api: OmniBridgeAPI | undefined;

/** Shared Omni Bridge API client. */
export function getOmniApi(): OmniBridgeAPI {
  api ??= new OmniBridgeAPI({ baseUrl: OMNI_API_BASE_URL });
  return api;
}

export { networkId as OMNI_NETWORK };

type SelectorLike = {
  wallet(): Promise<{
    signAndSendTransactions(params: {
      transactions: { actions: unknown[] }[];
    }): Promise<unknown>;
  } | null>;
};

/** The bridge SDK emits internal actions, near-wallet-selector wants NAJ. */
function toNajActions(actions: unknown[]): unknown[] {
  return actions.map((action) => {
    const a = action as Record<string, unknown> | undefined;
    // Only internal actions carry `type` and `params`. NAJ actions already have
    // their own key (functionCall, transfer, ...) and must be left alone,
    // because the bridge mixes both: the SDK's own transactions are internal
    // while any additionalTransactions the app supplies are built with
    // actionCreators, which is NAJ.
    return a && typeof a.type === "string" && a.params !== undefined
      ? internalActionToNaj(a as unknown as InternalAction)
      : action;
  });
}

/**
 * The Omni Bridge SDK builds NEAR transactions in the internal action shape
 * (`{ type: "FunctionCall", params }`) but hands them straight to
 * `wallet.signAndSendTransactions`, which near-wallet-selector defines in terms
 * of NAJ actions (`{ functionCall }`). Intear converts each action with
 * najActionToInternal, which throws "Unsupported NAJ action" for an internal
 * one, so every NEAR deposit failed at signing. Wallets that pass actions
 * through untouched happened to work, which is why this only surfaced on some.
 *
 * Wrapping the selector normalises the shape in one place instead of patching
 * the SDK, and leaves every other wallet method untouched.
 */
/** An outcome, plus the transaction hash the bridge API can be asked about. */
type NearTxOutcomeWithHash = NearTxOutcome & {
  transaction?: { hash?: string };
};

/**
 * What the wallet did with the last NEAR transaction we sent through it.
 *
 * The Omni SDK's NEAR client identifies a transfer by scraping an
 * `InitTransferEvent` out of the returned receipts' logs, and throws
 * "InitTransferEvent not found in transaction logs" when it is not there. That
 * conflates two unrelated causes: a receipt that did not execute, and a wallet that
 * returns outcomes with empty `receipts_outcome` — which several redirect wallets
 * do. Either way the SDK throws away the transaction hash, and with it our only
 * other handle on the transfer.
 *
 * The bridge API answers to a transaction hash as readily as to a nonce
 * (`fetchTransferByTxHash` reads either end), which is how the Solana side already
 * identifies its deposits. So the hash is kept here on the way past, and used when
 * the event cannot be found.
 *
 * `reverted` is what keeps that honest. The event is also missing when the deposit
 * genuinely failed, and a hash captured from a failed batch identifies nothing —
 * polling it returns 404 forever. So the failure state is recorded with it, and the
 * fallback is only taken when nothing reverted.
 */
let lastNearSend: { txHash?: string; reverted: boolean } | undefined;

/** What the last NEAR transaction did, or undefined if none was captured. */
export function lastCapturedNearSend(): { txHash?: string; reverted: boolean } {
  return lastNearSend ?? { txHash: undefined, reverted: false };
}

/** The last NEAR transaction hash seen, or undefined if none was captured. */
export function lastCapturedNearTxHash(): string | undefined {
  return lastNearSend?.txHash;
}

/** Forgets the captured send, so a stale one cannot identify the next transfer. */
export function clearCapturedNearTxHash(): void {
  lastNearSend = undefined;
}

export function withNajActions<T extends SelectorLike>(selector: T): T {
  return new Proxy(selector, {
    get(target, prop, receiver) {
      if (prop !== "wallet") return Reflect.get(target, prop, receiver);
      return async () => {
        const wallet = await target.wallet();
        if (!wallet) return wallet;
        return new Proxy(wallet, {
          get(walletTarget, walletProp, walletReceiver) {
            if (walletProp !== "signAndSendTransactions") {
              return Reflect.get(walletTarget, walletProp, walletReceiver);
            }
            return async (params: {
              transactions: { actions: unknown[] }[];
            }) => {
              const outcomes = (await walletTarget.signAndSendTransactions({
                ...params,
                transactions: params.transactions.map((tx) => ({
                  ...tx,
                  actions: toNajActions(tx.actions),
                })),
              })) as NearTxOutcomeWithHash[] | undefined;
              // The last transaction is the bridge's `ft_transfer_call`, and its
              // hash is the transfer's origin hash. Recorded whatever the wallet
              // hands back — including nothing, which is a case the caller has to
              // be able to tell apart from "no hash available".
              //
              // Whether anything reverted is recorded with it. The event is missing
              // when the batch failed just as often as when the wallet withholds the
              // logs, and a hash from a failed batch identifies nothing: the bridge
              // API has never heard of it, so polling it 404s until the attempt
              // budget runs out while the step shows a checkmark.
              const last = outcomes?.[outcomes.length - 1];
              const hash = last?.transaction?.hash;
              lastNearSend = {
                txHash: typeof hash === "string" ? hash : undefined,
                reverted: (outcomes ?? []).some((outcome) =>
                  isReverted(outcome),
                ),
              };
              return outcomes;
            };
          },
        });
      };
    },
  });
}

/** App `Network` -> Omni Bridge SDK `ChainKind`. */
export const NETWORK_TO_CHAIN_KIND = Object.fromEntries(
  Object.values(CHAINS).map((c) => [c.network, c.kind]),
) as Record<keyof typeof CHAINS, (typeof CHAINS)[keyof typeof CHAINS]["kind"]>;

/** Omni Bridge SDK `ChainKind` -> app `Network`. */
export const CHAIN_KIND_TO_NETWORK = Object.fromEntries(
  Object.values(CHAINS).map((c) => [c.kind, c.network]),
) as Record<(typeof CHAINS)[keyof typeof CHAINS]["kind"], keyof typeof CHAINS>;
