import { derived, get, writable } from "svelte/store";

import { client, type Trade } from "$lib/api/client";
import { queryClient } from "$lib/api/queries";
import { memesQueryFactory } from "$lib/api/queries/memes";
import { type Meme } from "$lib/models/memecooking";
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
  const memes = queryClient.getQueryData<Meme[]>(
    memesQueryFactory.memes.all().queryKey,
  );
  if (!memes) return;
  queryClient.setQueryData(memesQueryFactory.memes.all().queryKey, [
    ...memes,
    meme,
  ]);
}

export function bumpMeme(meme_id: number) {
  const memes = queryClient.getQueryData<Meme[]>(
    memesQueryFactory.memes.all().queryKey,
  );

  if (!memes) return;
  const index = memes.findIndex((m) => m.meme_id === meme_id);
  if (index === -1) return;
  queryClient.setQueryData(
    memesQueryFactory.memes.all().queryKey,
    memes.map((m, i) =>
      i === index
        ? {
            ...m,
            last_change_ms: Date.now(),
            animate: true,
          }
        : m,
    ),
  );

  setTimeout(() => {
    queryClient.setQueryData(
      memesQueryFactory.memes.all().queryKey,
      memes.map((m, i) =>
        i === index
          ? { ...m, last_change_ms: Date.now(), animate: false }
          : { ...m, animate: false },
      ),
    );
  }, 300);
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
  const response = await client.GET("/meme/{id}", {
    params: {
      path: { id: meme_id.toString() },
    },
  });

  if (!response.data) return null;

  const poolStats = projectedPoolStats(response.data.meme);
  const newMeme = {
    ...response.data.meme,
    projectedPoolStats: poolStats,
  };
  console.log("[getMeme] newMeme", get(newMeme.projectedPoolStats));

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

export function updateMemeFlagCount(
  meme_id: number,
  updater: (count: number) => number,
) {
  const memes = get(_memebids$);
  const index = memes.findIndex((m) => m.meme_id === meme_id);
  if (index === -1) return;

  const updatedMemes = [...memes];
  updatedMemes[index].flag_count = updater(updatedMemes[index].flag_count ?? 0);
  _memebids$.set(updatedMemes);
}
