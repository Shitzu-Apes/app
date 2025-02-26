import { writable } from "svelte/store";

import { type Trade } from "$lib/api/client";
import { queryClient } from "$lib/api/queries";
import { memesQueryFactory } from "$lib/api/queries/memes";
import { type Meme } from "$lib/models/memecooking";
import { projectedPoolStats } from "$lib/util/projectedMCap";

export const searchQuery$ = writable("");

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
  const memes = queryClient.getQueryData<Meme[]>(
    memesQueryFactory.memes.all().queryKey,
  );
  if (!memes) return;
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

  queryClient.setQueryData(
    memesQueryFactory.memes.all().queryKey,
    updatedMemes,
  );

  return newMeme;
}

export function updateMemeFlagCount(
  meme_id: number,
  updater: (count: number) => number,
) {
  const memes = queryClient.getQueryData<Meme[]>(
    memesQueryFactory.memes.all().queryKey,
  );
  if (!memes) return;
  const index = memes.findIndex((m) => m.meme_id === meme_id);
  if (index === -1) return;

  const updatedMemes = [...memes];
  updatedMemes[index].flag_count = updater(updatedMemes[index].flag_count ?? 0);
  queryClient.setQueryData(
    memesQueryFactory.memes.all().queryKey,
    updatedMemes,
  );
}
