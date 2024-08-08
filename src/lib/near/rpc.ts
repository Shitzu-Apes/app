import type { FinalExecutionOutcome } from "@near-wallet-selector/core";

// TODO this should fetch block height based on receipt,
// but we don't know which receipt so...
export async function fetchBlockHeight(outcome: FinalExecutionOutcome) {
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
