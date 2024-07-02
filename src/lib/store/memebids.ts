import { writable } from "svelte/store";

import { type MCMemeInfo } from "$lib/models/memecooking";

export const memebids = writable<MCMemeInfo[]>([]);

const ws = new WebSocket(import.meta.env.VITE_MEME_COOKING_WS_URL);

const callbacks: ((data: MCMemeInfo) => void)[] = [];

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  for (const callback of callbacks) {
    callback(data);
  }
};

export function MCsubscribe(callback: (data: MCMemeInfo) => void) {
  callbacks.push(callback);
}
