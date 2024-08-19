import { derived, get, writable } from "svelte/store";

import { client, type Trade } from "$lib/api/client";
import { type Meme } from "$lib/models/memecooking";

export const searchQuery$ = writable("");

const _memebids$ = writable<Promise<Meme[]>>(new Promise<never>(() => {}));
export const memebids$ = derived(_memebids$, (m) => m);

function udpateMemebids() {
  return client.GET("/meme").then((res) => {
    if (!res.data) return;
    console.log("[+page] memebids", res.data);
    _memebids$.set(Promise.resolve(res.data));
    return res.data;
  });
}
udpateMemebids();

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
  const cb = (data: LiveData) => {
    if (data.action === "new_trade") {
      callback(data.data);
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
  callbacks.set(id, callback);
}

export function MCunsubscribe(id: string | symbol) {
  callbacks.delete(id);
}

const symbol = Symbol("main_feed");
MCSubscribe(symbol, async (data) => {
  let newMemeInfo: Meme & { total_deposit: string; total_deposit_fees: string };
  if (data.action === "new_trade") {
    newMemeInfo = data.data;
  } else {
    newMemeInfo = {
      ...data.data,
      total_deposit: "0",
      total_deposit_fees: "0",
    };
  }

  let memebids = await get(memebids$);
  const idx = memebids.findIndex((b) => b.meme_id === newMemeInfo.meme_id);
  let meme = memebids[idx];
  if (meme == null) {
    const update = await udpateMemebids();
    if (update != null) {
      memebids = update;
      meme = memebids[idx];
    }
  }
  meme.total_deposit = newMemeInfo.total_deposit;
  meme.total_deposit_fees = newMemeInfo.total_deposit_fees;
  meme.last_change_ms = Date.now();

  _memebids$.set(
    Promise.resolve([
      meme,
      ...memebids.filter((b) => b.meme_id !== meme.meme_id),
    ]),
  );
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
