import { derived, writable, type Writable } from "svelte/store";

import { client } from "$lib/api/client";

const myFlags: Writable<number[]> = writable([]);
export const myFlags$ = derived(myFlags, (a) => a);

export async function fetchMyFlags(): Promise<number[]> {
  const res = await client
    .GET("/flag/my", {
      credentials: "include",
    })
    .then(({ data }) => (data?.flags ?? []).map((flag) => flag.meme_id))
    .catch((err) => {
      console.error("[fetchMyFlags]", err);
      return [];
    });
  const memeIds = res;
  myFlags.set(memeIds);
  return memeIds;
}

export async function flagMeme(memeId: number) {
  await client.POST("/flag/{memeId}", {
    params: { path: { memeId: memeId.toString() } },
    credentials: "include",
  });
  myFlags.update((a) => [...a, memeId]);
}

export async function unflagMeme(memeId: number) {
  await client.DELETE(`/flag/{memeId}`, {
    params: { path: { memeId: memeId.toString() } },
    credentials: "include",
  });

  myFlags.update((a) => a.filter((id) => id !== memeId));
}
