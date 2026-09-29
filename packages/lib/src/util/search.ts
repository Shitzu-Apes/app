import type { Meme } from "$lib/models/memecooking";

export function search<T extends Meme>(memes: T[], query: string): T[] {
  return memes.filter((meme) => {
    return (
      meme.name.toLowerCase().includes(query.toLowerCase()) ||
      meme.symbol.toLowerCase().includes(query.toLowerCase()) ||
      meme.owner.toLowerCase().includes(query.toLowerCase())
    );
  });
}
