import type { FinalExecutionOutcome } from "@near-wallet-selector/core";

import { nearWallet, type TransactionCallbacks } from "./wallet";

export async function view<T>(
  contract: string,
  method: string,
  args: Record<string, unknown>,
): Promise<T> {
  return viewWithNode(import.meta.env.VITE_NODE_URL, contract, method, args);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes("fetch") ||
      error.message.includes("timeout") ||
      error.message.includes("network") ||
      error.message.includes("ECONNRESET") ||
      error.message.includes("ENOTFOUND")
    );
  }
  return false;
}

function isRetryableHttpStatus(status: number): boolean {
  return status === 429;
}

export async function viewWithNode<T>(
  node: string,
  contract: string,
  method: string,
  args: Record<string, unknown>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(node, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "dontcare",
          method: "query",
          params: {
            request_type: "call_function",
            finality: "final",
            account_id: contract,
            method_name: method,
            args_base64: btoa(JSON.stringify(args)),
          },
        }),
      });

      // Check for HTTP errors that should trigger retry
      if (!res.ok && isRetryableHttpStatus(res.status)) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();
      // console.log("[view]: json", json);
      if ("error" in json) {
        console.error("[view]: Error", json.error.data);
        throw new Error(json.error.data);
      }
      const result = new Uint8Array(json.result.result);
      const decoder = new TextDecoder();

      return JSON.parse(decoder.decode(result));
    } catch (error: unknown) {
      lastError = error;

      if (attempt === maxRetries || !isRetryableError(error)) {
        console.error("[view]: Error", error);
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      console.warn(
        `[view]: Attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms...`,
        error,
      );

      await sleep(delay);
    }
  }

  console.error("[view]: All retry attempts failed", lastError);
  throw lastError;
}

export async function sendNear(
  receiverId: string,
  amount: string,
  callback: TransactionCallbacks<FinalExecutionOutcome> = {},
) {
  return nearWallet.signAndSendTransaction(
    {
      receiverId,
      actions: [
        {
          type: "Transfer",
          params: {
            deposit: amount,
          },
        },
      ],
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
