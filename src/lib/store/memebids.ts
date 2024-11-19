import { derived, get, writable } from "svelte/store";

import { client, type Trade } from "$lib/api/client";
import { EXTERNAL_MEMES } from "$lib/external_memes";
import { type Meme, type MemeInfo } from "$lib/models/memecooking";
import { MemeCooking } from "$lib/near/memecooking";
import { projectedPoolStats } from "$lib/util/projectedMCap";

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
  memes.push({
    ...meme,
    projectedPoolStats: projectedPoolStats(meme),
    pool_id: null,
  });
  console.log("[appendNewMeme] memes", memes);
  _memebids$.set([...memes]);
}

window.addEventListener("keydown", (event) => {
  console.log("[memebids] keydown", event);
  if (event.key !== "m") return;
  const newMeme = {
    meme_id: 168,
    owner: "spareemail6210.testnet",
    end_timestamp_ms: 1731993840295,
    name: "ettt",
    symbol: "etth",
    decimals: 18,
    total_supply: "1000000000000000000000000000",
    reference: "QmNZi23vxkpjYrvz6VsrwNvr9tV9LyCDZSowLXu6f8uM8n",
    reference_hash: "47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=",
    deposit_token_id: "wrap.testnet",
    soft_cap: "100000000000000000000000000",
    hard_cap: "500000000000000000000000000",
    last_change_ms: 1731990240295,
    created_blockheight: "179905365",
    created_timestamp_ms: 1731990240295,
    total_deposit: "0",
    total_deposit_fees: "0",
    total_withdraw_fees: "0",
    is_finalized: false,
    description: "etheth",
    twitter_link: "",
    telegram_link: "",
    website: "",
    image: "QmdtFmh2arJzpsEqKBDxYhBa4eSM9nALTpXoeWDYXZhfKs",
    pool_id: null,
  };
  appendNewMeme(newMeme);
});

const MEME_ORDER_LOCAL_STORAGE_KEY = "meme_order_store";

function pushMemeOrder(meme_id: number) {
  const memeOrder = JSON.parse(
    localStorage.getItem(MEME_ORDER_LOCAL_STORAGE_KEY) || "[]",
  );
  const memeOrderSet = new Set(memeOrder);
  memeOrderSet.delete(meme_id); // Remove if exists
  const newOrder = [meme_id, ...Array.from(memeOrderSet)]; // Add to front
  localStorage.setItem(MEME_ORDER_LOCAL_STORAGE_KEY, JSON.stringify(newOrder));
}

function getMemeOrder() {
  const memeOrder = localStorage.getItem(MEME_ORDER_LOCAL_STORAGE_KEY);
  return memeOrder ? JSON.parse(memeOrder) : [];
}

export function bumpMeme(meme_id: number) {
  const memes = get(_memebids$);
  const index = memes.findIndex((m) => m.meme_id === meme_id);
  if (index === -1) return;

  const updatedMeme = {
    ...memes[index],
    last_change_ms: Date.now(),
    animate: true,
    projectedPoolStats: projectedPoolStats(memes[index]),
  };

  pushMemeOrder(meme_id);

  const updatedMemes = [...memes];
  updatedMemes[index] = updatedMeme;

  _memebids$.set(updatedMemes);

  setTimeout(() => {
    const memesAfter = get(_memebids$);
    const memeIndex = memesAfter.findIndex((m) => m.meme_id === meme_id);
    if (memeIndex === -1) return;

    const updatedMemeAfter = {
      ...memesAfter[memeIndex],
      animate: false,
    };

    const updatedMemesAfter = [...memesAfter];
    updatedMemesAfter[memeIndex] = updatedMemeAfter;

    _memebids$.set(updatedMemesAfter);
  }, 300);
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
        projectedPoolStats: projectedPoolStats(meme),
      };
    });
    EXTERNAL_MEMES.forEach((meme) => {
      console.log("[updateMemebids::EXTERNAL_MEMES] meme", meme);
      if (meme) {
        memes.push(meme);
      }
    });
    console.log("[+page] memebids", memes);
    const memeOrder = getMemeOrder();

    // overwrite last_change_ms for memes in memeOrder
    const memesWithOrder = memes.map((meme) => {
      const index = memeOrder.indexOf(meme.meme_id);
      if (index !== -1) {
        return {
          ...meme,
          last_change_ms: Date.now() - index * 1000,
        };
      }
      return meme;
    });

    _memebids$.set(memesWithOrder);
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
        last_change_ms: Date.now(),
        total_supply_num: parseFloat(meme.total_supply),
        created_blockheight: "0",
        created_timestamp_ms: 0,
        total_deposit: meme.total_staked,
        total_deposit_fees: "0",
        total_withdraw_fees: meme.total_withdrawal_fees,
        is_finalized: false,
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
      EXTERNAL_MEMES.forEach((meme) => {
        console.log("[updateMemebids::EXTERNAL_MEMES] meme", meme);
        if (meme) {
          adaptedMemes.push(meme);
        }
      });
      _memebids$.set(adaptedMemes);
    } catch (error) {
      console.error("Failed to fetch backup memebids", error);
    }
  } finally {
    memebidsLoading$.set(false);
  }
}

export function processTradeAndUpdateMemebids(trade: Meme & Trade) {
  const memes = get(_memebids$);
  const index = memes.findIndex((m) => m.meme_id === trade.meme_id);
  if (index === -1) return;

  const meme = memes[index];
  const total_deposit = BigInt(meme.total_deposit || "0");
  const amount = trade.is_deposit
    ? BigInt(trade.amount || "0")
    : -BigInt(trade.amount || "0") - BigInt(trade.fee || "0");
  const newTotalDeposit = total_deposit + amount;

  const newMeme = {
    ...meme,
    total_deposit: newTotalDeposit.toString(),
  };
  const updatedMemes = [...memes];
  updatedMemes[index] = {
    ...newMeme,
    projectedPoolStats: projectedPoolStats(newMeme),
  };

  _memebids$.set(updatedMemes);

  return newMeme;
}

export async function getMeme(meme_id: number) {
  console.log("[getMeme] meme_id", meme_id);
  const response = await client.GET("/meme/{id}", {
    params: {
      path: { id: meme_id.toString() },
    },
  });

  if (!response.data) return null;

  const newMeme = {
    ...response.data.meme,
    projectedPoolStats: projectedPoolStats(response.data.meme),
  };

  const memes = get(_memebids$);
  const index = memes.findIndex((m) => m.meme_id === meme_id);
  if (index === -1) {
    const updatedMemes = [...memes];
    updatedMemes.push(newMeme);
    _memebids$.set(updatedMemes);
  } else {
    const updatedMemes = [...memes];
    updatedMemes[index] = newMeme;
    _memebids$.set(updatedMemes);
  }

  return newMeme;
}
