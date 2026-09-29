import { writable } from "svelte/store";

import { client } from "$lib/api/client";
import { rpcFetch } from "$lib/near/rpc-retry";
import { pollUntil } from "$lib/util/pollUntil";

export const indexer_last_block_height$ = writable<number | null>(null);
/**
 * Highest block the indexer has observed, regardless of whether it carried
 * events. Unlike `indexer_last_block_height$` this does not stall while the
 * contract is quiet, so it is what the health badge compares against the node.
 */
export const indexer_last_seen_block_height$ = writable<number | null>(null);
export const node_last_block_height$ = writable<number | null>(null);

const REFETCH_DELAY = 2_000;
const FINAL_DELAY = 1_000;

export function awaitIndexerBlockHeight(blockHeight: number) {
  return pollUntil({
    refetchDelay: REFETCH_DELAY,
    finalDelay: FINAL_DELAY,
    tick: async () => (await client.GET("/info")).data?.last_block_height ?? 0,
    isDone: (currentBlockHeight) => currentBlockHeight >= blockHeight,
    onValue: (currentBlockHeight) =>
      indexer_last_block_height$.set(currentBlockHeight),
    onError: (error) =>
      console.warn("[awaitIndexerBlockHeight]: poll failed, retrying", error),
  });
}

export function awaitRpcBlockHeight(blockHeight: number) {
  return pollUntil({
    refetchDelay: REFETCH_DELAY,
    finalDelay: FINAL_DELAY,
    tick: () =>
      rpcFetch<{ sync_info: { latest_block_height: number } }>(
        import.meta.env.VITE_NODE_URL,
        { method: "status", params: [] },
      ),
    isDone: (status) => status.sync_info.latest_block_height >= blockHeight,
    onValue: (status) =>
      node_last_block_height$.set(status.sync_info.latest_block_height),
    onError: (error) =>
      console.warn("[awaitRpcBlockHeight]: poll failed, retrying", error),
  });
}
