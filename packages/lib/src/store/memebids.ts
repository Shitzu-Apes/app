import { writable } from "svelte/store";

import { type Trade } from "$lib/api/client";
import { queryClient } from "$lib/api/queries";
import { memesQueryFactory } from "$lib/api/queries/memes";
import { type Meme } from "$lib/models/memecooking";
import { projectedPoolStats } from "$lib/util/projectedMCap";

export const searchQuery$ = writable("");

const memesKey = memesQueryFactory.memes.all().queryKey;

/**
 * Replace a single meme in the cached list. Other entries keep their identity
 * so the work stays proportional to the meme that changed.
 */
function patchMeme(
  memeId: number,
  patch: (meme: Meme) => Meme,
): Meme | undefined {
  const memes = queryClient.getQueryData<Meme[]>(memesKey);
  if (!memes) return;
  const index = memes.findIndex((meme) => meme.meme_id === memeId);
  if (index === -1) return;

  const updated = memes.slice();
  updated[index] = patch(memes[index]);
  queryClient.setQueryData(memesKey, updated);
  return updated[index];
}

export function appendNewMeme(meme: Meme) {
  const memes = queryClient.getQueryData<Meme[]>(memesKey);
  if (!memes) return;
  // The websocket can replay a meme that is already in the list.
  if (memes.some((existing) => existing.meme_id === meme.meme_id)) return;
  queryClient.setQueryData(memesKey, [...memes, meme]);
}

/** Timeout handles for the shake animation, keyed by meme id. */
const bumpTimers = new Map<number, ReturnType<typeof setTimeout>>();

export function bumpMeme(meme_id: number) {
  if (!queryClient.getQueryData<Meme[]>(memesKey)) return;

  // Already shaking: just extend the highlight instead of rewriting the list.
  if (!bumpTimers.has(meme_id)) {
    const patched = patchMeme(meme_id, (meme) => ({
      ...meme,
      last_change_ms: Date.now(),
      animate: true,
    }));
    if (!patched) return;
  }

  const existing = bumpTimers.get(meme_id);
  if (existing) clearTimeout(existing);

  bumpTimers.set(
    meme_id,
    setTimeout(() => {
      bumpTimers.delete(meme_id);
      // Re-read the cache: trades and new memes may have landed since the bump
      // started, and the old snapshot must not clobber them.
      patchMeme(meme_id, (meme) => ({ ...meme, animate: false }));
    }, 300),
  );
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

  patchMeme(trade.meme_id, () => ({
    ...newMeme,
    projectedPoolStats: projectedPoolStats(newMeme),
  }));

  return newMeme;
}

export function updateMemeFlagCount(
  meme_id: number,
  updater: (count: number) => number,
) {
  patchMeme(meme_id, (meme) => ({
    ...meme,
    flag_count: updater(meme.flag_count ?? 0),
  }));
}
