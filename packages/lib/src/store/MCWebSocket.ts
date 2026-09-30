import { writable } from "svelte/store";

import type { Meme, Trade } from "$lib/api/client";
import { queryClient } from "$lib/api/queries";
import { memesQueryFactory } from "$lib/api/queries/memes";
import { bumpMeme, processTradeAndUpdateMemebids } from "$lib/store/memebids";

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

/**
 * Coalescing window for websocket events (ms).
 *
 * The feed can deliver several trades per second, and every event used to
 * rewrite the meme list and re-render the board. Batching them keeps the main
 * thread free for painting.
 */
const FLUSH_INTERVAL_MS = 250;
/** Upper bound on buffered events so a hidden tab cannot queue without bound. */
const MAX_BUFFERED_EVENTS = 500;

const bufferedEvents: LiveData[] = [];
let flushScheduled = false;

function dispatch(data: LiveData) {
  if (data.action === "new_trade") {
    const newMeme = processTradeAndUpdateMemebids(data.data);
    if (newMeme) {
      data = { ...data, data: { ...data.data, ...newMeme } };
    }
  }
  callbacks.forEach((callback) => {
    callback(data);
  });
}

function flushEvents() {
  flushScheduled = false;
  const batch = bufferedEvents.splice(0, bufferedEvents.length);
  batch.forEach(dispatch);
}

function enqueueEvent(data: LiveData) {
  bufferedEvents.push(data);
  if (bufferedEvents.length > MAX_BUFFERED_EVENTS) {
    bufferedEvents.splice(0, bufferedEvents.length - MAX_BUFFERED_EVENTS);
  }
  if (flushScheduled) return;
  flushScheduled = true;
  setTimeout(flushEvents, FLUSH_INTERVAL_MS);
}

export function initializeWebsocket(ws: WebSocket) {
  ws.onmessage = (event) => {
    enqueueEvent(JSON.parse(event.data) as LiveData);
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
      const trade: Trade = data.data;
      const memes = queryClient.getQueryData<Meme[]>(
        memesQueryFactory.memes.all().queryKey,
      );
      if (!memes) return;
      const meme = memes.find((m) => m.meme_id === trade.meme_id);
      if (!meme) return;
      callback({
        ...meme,
        ...trade,
      });
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
MCSubscribe(symbol, (data) => {
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
