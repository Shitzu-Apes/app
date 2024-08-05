export function getTokenId(symbol: string, memeId: number) {
  return `${symbol.toLowerCase()}-${memeId}.${import.meta.env.VITE_MEME_COOKING_CONTRACT_ID}`;
}
