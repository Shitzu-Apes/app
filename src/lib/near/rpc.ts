import type { FinalExecutionOutcome } from "@near-wallet-selector/core";

// TODO this should fetch block height based on receipt,
// but we don't know which receipt so...
export async function fetchBlockHeight(
  outcomes: FinalExecutionOutcome | FinalExecutionOutcome[],
) {
  let outcome: FinalExecutionOutcome;
  if (Array.isArray(outcomes)) {
    outcome = outcomes[outcomes.length - 1];
  } else {
    outcome = outcomes;
  }
  const res = await fetch(import.meta.env.VITE_NODE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "dontcare",
      method: "block",
      params: {
        // FIXME typings
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        block_id: (outcome.transaction_outcome as any).block_hash,
      },
    }),
  });
  const json = (await res.json()) as {
    result: { header: { height: number } };
  };
  return json.result.header.height;
}

export async function checkIfAccountExists(token_id: string) {
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
        request_type: "view_account",
        finality: "optimistic",
        account_id: token_id,
      },
    }),
  });
  const json = (await res.json()) as {
    result?: unknown;
    error?: unknown;
  };
  return json.error == null;
}
