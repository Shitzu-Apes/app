import { writable } from "svelte/store";

import { type MCMemeInfo } from "$lib/models/memecooking";

export const memebids = writable<MCMemeInfo[]>([]);

export const ws = writable(
  (() => {
    const ws = new WebSocket(import.meta.env.VITE_MEME_COOKING_WS_URL);

    ws.onopen = () => {
      console.log("[ws.onopen]: Connection opened");
      ws.send(JSON.stringify({ action: "subscribe" }));
    };

    return ws;
  })(),
);

const callbacks: Map<string | symbol, (data: MCMemeInfo) => void> = new Map();
export function initializeWebsocket(ws: WebSocket) {
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    callbacks.forEach((callback) => {
      callback(data);
    });
  };

  ws.onclose = (...args) => {
    console.log("[ws.onclose]: Connection closed", args);
  };
}

export function MCsubscribe(
  id: string | symbol,
  callback: (data: MCMemeInfo) => void,
) {
  callbacks.set(id, callback);
}

export function MCunsubscribe(id: string | symbol) {
  callbacks.delete(id);
}
