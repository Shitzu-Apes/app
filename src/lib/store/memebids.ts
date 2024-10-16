import { derived, get, writable } from "svelte/store";

import { browser } from "$app/environment";
import { client, type Trade } from "$lib/api/client";
import { type Meme, type MemeInfo } from "$lib/models/memecooking";
import { MemeCooking } from "$lib/near/memecooking";

export const searchQuery$ = writable("");

const _memebids$ = writable<Promise<Meme[]>>(new Promise<never>(() => {}));
export const memebids$ = derived(_memebids$, (m) => m);
export const memeMap$ = derived(memebids$, async (memes) => {
  const memeMap = new Map<number, Meme>(
    (await memes).map((m) => [m.meme_id, m]),
  );
  return memeMap;
});

export function updateMemebids() {
  return client
    .GET("/meme")
    .then((res) => {
      if (!res.data) return;
      console.log("[+page] memebids", res.data);
      _memebids$.set(Promise.resolve(res.data));
      return res.data;
    })
    .catch(() => {
      console.log("[updateMemebids]: Error");
      MemeCooking.getLatestMeme().then((res) => {
        // use this as a backup

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
          last_change_ms: Date.now(), // Placeholder, adjust as needed
          total_supply_num: parseFloat(meme.total_supply),
          created_blockheight: 0, // Placeholder, adjust as needed
          created_timestamp_ms: 0, // Placeholder, adjust as needed
          total_deposit: meme.total_staked,
          total_deposit_num: parseFloat(meme.total_staked),
          total_deposit_fees: "0", // Placeholder, adjust as needed
          total_deposit_fees_num: 0, // Placeholder, adjust as needed
          total_withdraw_fees: meme.total_withdrawal_fees,
          total_withdraw_fees_num: parseFloat(meme.total_withdrawal_fees),
          is_finalized: null, // Placeholder, adjust as needed
          token_id: null, // Placeholder, adjust as needed
          pool_id: null, // Placeholder, adjust as needed
          description: null, // Placeholder, adjust as needed
          twitterLink: null, // Placeholder, adjust as needed
          telegramLink: null, // Placeholder, adjust as needed
          website: null, // Placeholder, adjust as needed
          image: meme.icon,
          coronated_at_ms: null, // Placeholder, adjust as needed
          replies_count: 0, // Placeholder, adjust as needed
          staker_count: 0, // Placeholder, adjust as needed
        }));
        _memebids$.set(Promise.resolve(adaptedMemes));
      });
    });
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
      const response = await client.GET("/meme/{id}", {
        params: {
          path: {
            id: String(data.data.meme_id),
          },
        },
      });
      const meme = response.data?.meme;
      if (meme == null) return;
      const memes = await get(_memebids$);
      const index = memes.findIndex(({ meme_id }) => meme.meme_id === meme_id);
      if (index !== -1) {
        memes[index] = meme;
        _memebids$.set(Promise.resolve(memes));
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
      const response = await client.GET("/meme/{id}", {
        params: {
          path: {
            id: String(data.data.meme_id),
          },
        },
      });
      const meme = response.data?.meme;
      if (meme == null) return;
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

  let memebids = await get(memebids$);
  const idx = memebids.findIndex((b) => b.meme_id === newMemeInfo.meme_id);
  let meme = memebids[idx];
  if (meme == null) {
    const update = await updateMemebids();
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
