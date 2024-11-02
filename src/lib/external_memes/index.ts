import { type Readable } from "svelte/store";

import tokens from "../../tokens.json";

import type { Meme } from "$lib/api/client";
import { FixedNumber } from "$lib/util/FixedNumber";
import { projectedMCap, projectedMCapFromPool } from "$lib/util/projectedMCap";

export const external_memes: Record<
  string,
  Meme & { projectedMcap: Readable<FixedNumber> }
> = {};

let index = -1;
for (const token of tokens) {
  external_memes[token.token_id] = {
    token_id: token.token_id,
    owner: token.owner,
    name: token.name,
    symbol: token.symbol,
    decimals: token.decimals,
    total_supply: token.total_supply,
    total_supply_num: Number(token.total_supply),
    pool_id: token.pool_id,
    description: token.description,
    image: token.image,
    telegramLink: token.telegramLink,
    twitterLink: token.twitterLink,
    website: token.website,
    meme_id: index--,
    end_timestamp_ms: new Date(token.created).valueOf(),
    reference: "",
    reference_hash: "",
    deposit_token_id: "",
    soft_cap: null,
    hard_cap: null,
    last_change_ms: 0,
    soft_cap_num: 0,
    hard_cap_num: null,
    team_allocation: null,
    team_allocation_num: null,
    vesting_duration_ms: null,
    cliff_duration_ms: null,
    created_blockheight: 0,
    created_timestamp_ms: new Date(token.created).valueOf(),
    total_deposit: "0",
    total_deposit_num: 0,
    total_deposit_fees: "0",
    total_deposit_fees_num: 0,
    total_withdraw_fees: "0",
    total_withdraw_fees_num: 0,
    is_finalized: true,
    coronated_at_ms: null,
    replies_count: 0,
    staker_count: 0,
    projectedMcap: projectedMCapFromPool({
      pool_id: token.pool_id,
      decimals: token.decimals,
      total_supply: token.total_supply,
    }),
  };
}

export function getExternalMeme(
  tokenId: string,
): (Meme & { projectedMcap: Readable<FixedNumber> }) | null {
  const meme = external_memes[tokenId];
  if (!meme) {
    return null;
  }
  return {
    ...meme,
    projectedMcap: projectedMCap(meme),
  };
}

export const EXTERNAL_MEMES = Object.values(external_memes);
