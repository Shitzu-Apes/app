import { derived, get, writable } from "svelte/store";

import { browser } from "$app/environment";
import { client } from "$lib/api/client";
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
  const index = memes.findIndex((m) => m.meme_id === meme_id);
  if (index === -1) return;

  const updatedMeme = {
    ...memes[index],
    last_change_ms: Date.now(),
    animate: true,
    projectedMcap: projectedMCap(memes[index]),
  };

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
  }, 250);
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

export async function updateProjectedMcap(meme_id: number) {
  const memes = get(_memebids$);
  const index = memes.findIndex((m) => m.meme_id === meme_id);
  if (index === -1) return;

  const updatedMemes = [...memes];
  updatedMemes[index] = {
    ...memes[index],
    projectedMcap: projectedMCap(memes[index]),
  };
  _memebids$.set([...updatedMemes]);
}

if (browser) {
  updateMemebids();
}
