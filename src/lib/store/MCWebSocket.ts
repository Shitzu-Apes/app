import { writable } from "svelte/store";

import type { Meme, Trade } from "$lib/api/client";
import { bumpMeme, updateProjectedMcap } from "$lib/store/memebids";

type LiveData =
  | {
      action: "new_trade";
      data: Meme & Trade;
    }
  | {
      action: "new_meme";
      data: Meme;
    };

const callbacks: Map<string | symbol, (data: LiveData) => void> = new Map();

export function initializeWebsocket(ws: WebSocket) {
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log("[ws.onmessage]:", data);
    callbacks.forEach((callback) => {
      callback(data);
    });
  };

  ws.onclose = (...args) => {
    console.log("[ws.onclose]: Connection closed", args);
  };
}

export function MCTradeSubscribe(
  id: string | symbol,
  callback: (data: Meme & Trade) => void,
) {
  const cb = async (data: LiveData) => {
    if (data.action === "new_trade") {
      const meme = data.data;
      callback({ ...meme, ...data.data });
      updateProjectedMcap(Number(meme.meme_id));
    }
  };
  callbacks.set(id, cb);
}

export function MCMemeSubscribe(
  id: string | symbol,
  callback: (data: Meme) => void,
) {
  const cb = (data: LiveData) => {
    if (data.action === "new_meme") {
      callback(data.data);
    }
  };
  callbacks.set(id, cb);
}

export function MCSubscribe(
  id: string | symbol,
  callback: (data: LiveData) => void,
) {
  const cb = async (data: LiveData) => {
    if (data.action === "new_trade") {
      const meme = data.data;
      callback({ action: "new_trade", data: { ...meme, ...data.data } });
    } else if (data.action === "new_meme") {
      callback({ action: "new_meme", data: data.data });
    }
  };
  callbacks.set(id, cb);
}

export function MCunsubscribe(id: string | symbol) {
  callbacks.delete(id);
}

const symbol = Symbol("main_feed");
MCSubscribe(symbol, async (data) => {
  console.log("[main_feed] meme_id", data.data.meme_id);
  const memeId = Number(data.data.meme_id.toString());
  bumpMeme(memeId);
});

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
