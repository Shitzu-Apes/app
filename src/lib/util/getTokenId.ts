import type { Meme } from "$lib/models/memecooking";

export function getTokenId(
  meme: Pick<Meme, "symbol" | "meme_id" | "token_id">,
) {
  return meme.meme_id < 0
    ? meme.token_id!
    : `${meme.symbol.toLowerCase()}-${meme.meme_id}.${import.meta.env.VITE_MEME_COOKING_CONTRACT_ID}`;
}
