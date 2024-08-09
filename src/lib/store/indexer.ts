import { writable } from "svelte/store";

import { client } from "$lib/api/client";

export const indexer_last_block_height$ = writable<number | null>(null);
export const node_last_block_height$ = writable<number | null>(null);

const REFETCH_DELAY = 2_000;
const FINAL_DELAY = 1_000;

export function awaitIndexerBlockHeight(blockHeight: number) {
  const updateBlockHeight = async (resolve: (value: unknown) => void) => {
    const res = await client.GET("/info");
    const currentBlockHeight = res.data?.last_block_height ?? 0;
    indexer_last_block_height$.set(currentBlockHeight);
    if (currentBlockHeight >= blockHeight) {
      setTimeout(resolve, FINAL_DELAY);
    } else {
      setTimeout(() => updateBlockHeight(resolve), REFETCH_DELAY);
    }
  };
  return new Promise(updateBlockHeight);
}

export function awaitRpcBlockHeight(blockHeight: number) {
  const updateBlockHeight = async (resolve: (value: unknown) => void) => {
    const nodeUrl = import.meta.env.VITE_NODE_URL;
    const response = await fetch(nodeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "dontcare",
        method: "status",
        params: [],
      }),
    });
    const data = await response.json();
    const currentBlockHeight = data.result.sync_info.latest_block_height;
    node_last_block_height$.set(currentBlockHeight);
    if (currentBlockHeight >= blockHeight) {
      setTimeout(resolve, FINAL_DELAY);
    } else {
      setTimeout(() => updateBlockHeight(resolve), REFETCH_DELAY);
    }
  };
  return new Promise(updateBlockHeight);
}
