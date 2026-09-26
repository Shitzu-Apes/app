import type { FinalExecutionOutcome } from "@near-wallet-selector/core";

import { rpcFetch, RpcResponseError } from "./rpc-retry";

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
  const result = await rpcFetch<{ header: { height: number } }>(
    import.meta.env.VITE_NODE_URL,
    {
      method: "block",
      params: {
        // FIXME typings
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        block_id: (outcome.transaction_outcome as any).block_hash,
      },
    },
  );
  return result.header.height + outcome.receipts_outcome.length;
}

export async function checkIfAccountExists(token_id: string) {
  try {
    await rpcFetch<unknown>(import.meta.env.VITE_NODE_URL, {
      method: "query",
      params: {
        request_type: "view_account",
        finality: "optimistic",
        account_id: token_id,
      },
    });
    return true;
  } catch (error: unknown) {
    // A missing account answers with a JSON-RPC error; that is the answer we
    // wanted. Anything else (rate limit, unreachable node) is a real failure.
    if (error instanceof RpcResponseError) {
      return false;
    }
    throw error;
  }
}
