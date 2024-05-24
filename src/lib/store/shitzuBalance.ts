import { FixedNumber } from "@tarnadas/fixed-number";
import { writable } from "svelte/store";

export const shitzuBalance = writable<FixedNumber | null>(null);

export async function refreshShitzuBalance(accountId?: string): Promise<void> {
  if (typeof accountId !== "string") {
    shitzuBalance.set(null);
    return;
  }

  const args = {
    account_id: accountId,
  };

  const args_base64 = Buffer.from(JSON.stringify(args)).toString("base64");

  const res = await fetch(import.meta.env.VITE_NODE_URL, {
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
        account_id: "token.0xshitzu.near",
        method_name: "ft_balance_of",
        args_base64,
      },
    }),
  });

  const json = await res.json();

  const result = new Uint8Array(json.result.result);
  const decoder = new TextDecoder();

  const balance = JSON.parse(decoder.decode(result));

  shitzuBalance.set(new FixedNumber(balance, 18));
}
