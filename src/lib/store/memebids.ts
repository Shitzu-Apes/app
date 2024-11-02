import { derived, get, writable } from "svelte/store";

import { browser } from "$app/environment";
import { client, type Trade } from "$lib/api/client";
import { type Meme, type MemeInfo } from "$lib/models/memecooking";
import { MemeCooking } from "$lib/near/memecooking";
import { projectedMCap } from "$lib/util/projectedMCap";

export const searchQuery$ = writable("");

// Stores the actual memes array, not a promise
const _memebids$ = writable<Meme[]>([]);
export const memebids$ = derived(_memebids$, (m) => m);
export const memeMap$ = derived(memebids$, (memes) => {
  const memeMap = new Map<number, Meme>(memes.map((m) => [m.meme_id, m]));
  return memeMap;
});

export const memebidsLoading$ = writable(false);
export const memebidsError$ = writable<Error | null>(null);

export function appendNewMeme(meme: Meme) {
  const memes = get(_memebids$);
  memes.push(meme);
  _memebids$.set(memes);
}

export function bumpMeme(meme_id: number) {
  const memes = get(_memebids$);
  const meme = memes.find((m) => m.meme_id === meme_id);
  if (!meme) return;
  meme.last_change_ms = Date.now();
  meme.projectedMcap = projectedMCap(meme);
  _memebids$.set(memes);
}

export async function updateMemebids() {
  memebidsLoading$.set(true);
  memebidsError$.set(null);
  try {
    const res = await client.GET("/meme");
    if (!res.data) return;
    const memes: Meme[] = res.data.map((meme) => {
      return {
        ...meme,
        projectedMcap: projectedMCap(meme),
      };
    });
    console.log("[+page] memebids", memes);
    _memebids$.set(memes);
  } catch (error) {
    console.log("[updateMemebids]: Error", error);
    memebidsError$.set(error as Error);
    try {
      const res = await MemeCooking.getLatestMeme();
      console.log("fetching backup memebids");
      const filteredMemes = res.filter(
        (meme): meme is MemeInfo => meme !== null,
      );
      const adaptedMemes: Meme[] = filteredMemes.map((meme) => ({
        meme_id: meme.id,
        owner: meme.owner,
        end_timestamp_ms: meme.end_timestamp_ms
          ? parseInt(meme.end_timestamp_ms)
          : null,
        name: meme.name,
        symbol: meme.symbol,
        decimals: meme.decimals,
        total_supply: meme.total_supply,
        reference: meme.reference,
        reference_hash: meme.reference_hash,
        deposit_token_id: meme.deposit_token_id,
        soft_cap: "0",
        soft_cap_num: 0,
        last_change_ms: 0,
        total_supply_num: parseFloat(meme.total_supply),
        created_blockheight: 0,
        created_timestamp_ms: 0,
        total_deposit: meme.total_staked,
        total_deposit_num: parseFloat(meme.total_staked),
        total_deposit_fees: "0",
        total_deposit_fees_num: 0,
        total_withdraw_fees: meme.total_withdrawal_fees,
        total_withdraw_fees_num: parseFloat(meme.total_withdrawal_fees),
        is_finalized: null,
        token_id: null,
        pool_id: null,
        description: null,
        twitterLink: null,
        telegramLink: null,
        website: null,
        image: meme.icon,
        coronated_at_ms: null,
        replies_count: 0,
        staker_count: 0,
      }));
      _memebids$.set(adaptedMemes);
    } catch (error) {
      console.error("Failed to fetch backup memebids", error);
    }
  } finally {
    memebidsLoading$.set(false);
  }
}

if (browser) {
  updateMemebids();
}

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
      const memes = get(_memebids$);
      const index = memes.findIndex(({ meme_id }) => meme.meme_id === meme_id);
      if (index !== -1) {
        memes[index] = { ...meme, projectedMcap: projectedMCap(meme) };
        _memebids$.set(memes);
      }
      callback({ ...meme, ...data.data });
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

  const memebids = get(_memebids$);
  const idx = memebids.findIndex((b) => b.meme_id === newMemeInfo.meme_id);
  let meme = memebids[idx];
  if (meme == null) {
    await updateMemebids();
    meme = get(_memebids$)[idx];
  }
  if (!meme) return;

  meme.total_deposit = newMemeInfo.total_deposit;
  meme.total_deposit_fees = newMemeInfo.total_deposit_fees;
  meme.last_change_ms = Date.now();
  meme.projectedMcap = projectedMCap(meme);

  _memebids$.set(memebids);
  bumpMeme(meme.meme_id);
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

// For development/testing - press 'c' to simulate a new trade
if (import.meta.env.DEV) {
  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "c") {
      const memebids = get(_memebids$);
      if (memebids.length === 0) return;

      // Pick a random meme from existing memebids
      const randomMeme = memebids[Math.floor(Math.random() * memebids.length)];
      console.log("randomMeme", randomMeme);

      bumpMeme(randomMeme.meme_id);
      console.log("randomMeme", randomMeme);
      // Create mock trade data
      const mockTrade: LiveData = {
        action: "new_trade",
        data: {
          ...randomMeme,
          total_deposit: (
            BigInt(randomMeme.total_deposit || "0") +
            BigInt("1000000000000000000000000")
          ).toString(),
          total_deposit_fees: (
            BigInt(randomMeme.total_deposit_fees || "0") +
            BigInt("100000000000000000000000")
          ).toString(),
          is_deposit: true,
          account_id: "test.near",
          amount: "1000000000000000000000000",
          amount_num: 100,
          fee: "100000000000000000000000",
          fee_num: 1,
          timestamp_ms: Date.now(),
          receipt_id: Math.random().toString(36).substring(2, 15),
        },
      };

      callbacks.forEach((callback) => {
        callback(mockTrade as LiveData);
      });
    }
  });
}
