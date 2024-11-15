import tokens from "../../tokens.json";

import type { Meme } from "$lib/models/memecooking";
import { projectedPoolStats } from "$lib/util/projectedMCap";

export const external_memes: Record<string, Meme> = {};

let index = -1;
for (const token of tokens) {
  const meme: Meme = {
    token_id: token.token_id,
    owner: token.owner,
    name: token.name,
    symbol: token.symbol,
    decimals: token.decimals,
    total_supply: token.total_supply,
    pool_id: token.pool_id,
    description: token.description,
    image: token.image,
    telegram_link: token.telegramLink,
    twitter_link: token.twitterLink,
    website: token.website,
    meme_id: index--,
    end_timestamp_ms: new Date(token.created).valueOf(),
    reference: "",
    reference_hash: "",
    deposit_token_id: "",
    soft_cap: "0",
    hard_cap: undefined,
    last_change_ms: "0",
    team_allocation: "0",
    vesting_duration_ms: null,
    cliff_duration_ms: null,
    created_blockheight: "0",
    created_timestamp_ms: new Date(token.created).toISOString(),
    total_deposit: "0",
    total_deposit_fees: "0",
    total_withdraw_fees: "0",
    is_finalized: true,
    replies_count: 0,
    staker_count: 0,
  };
  const poolStats = projectedPoolStats(meme);
  external_memes[token.token_id] = { ...meme, projectedPoolStats: poolStats };
}

export function getExternalMeme(tokenId: string): Meme | null {
  const meme = external_memes[tokenId];
  if (!meme) {
    return null;
  }
  return {
    ...meme,
    projectedPoolStats: projectedPoolStats(meme),
  };
}

export const EXTERNAL_MEMES = Object.values(external_memes);
