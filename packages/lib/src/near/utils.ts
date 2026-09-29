import { actionCreators } from "@near-wallet-selector/core";
import type { FinalExecutionOutcome } from "@near-wallet-selector/core";

import { rpcFetch } from "./rpc-retry";
import { nearWallet, type TransactionCallbacks } from "./wallet";

export async function view<T>(
  contract: string,
  method: string,
  args: Record<string, unknown>,
): Promise<T> {
  return viewWithNode(import.meta.env.VITE_NODE_URL, contract, method, args);
}

export async function viewWithNode<T>(
  node: string,
  contract: string,
  method: string,
  args: Record<string, unknown>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
): Promise<T> {
  const result = await rpcFetch<{ result: number[] }>(
    node,
    {
      method: "query",
      params: {
        request_type: "call_function",
        finality: "final",
        account_id: contract,
        method_name: method,
        args_base64: btoa(JSON.stringify(args)),
      },
    },
    { maxRetries, baseDelay },
  );

  const bytes = new Uint8Array(result.result);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

export async function sendNear(
  receiverId: string,
  amount: string,
  callback: TransactionCallbacks<FinalExecutionOutcome> = {},
) {
  return nearWallet.signAndSendTransaction(
    {
      receiverId,
      actions: [actionCreators.transfer(BigInt(amount))],
    },
    callback,
  );
}

export function formatAddress(address: string) {
  const isNamed = address.includes(".");
  return isNamed
    ? address.split(".")[0]
    : address.slice(0, 4) + "..." + address.slice(-4);
}
