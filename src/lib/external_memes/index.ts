import { readable, type Readable } from "svelte/store";

import type { Meme } from "$lib/api/client";
import SHITZU_LOGO from "$lib/assets/logo/shitzu.webp";
import { FixedNumber } from "$lib/util/FixedNumber";
import { projectedMCap } from "$lib/util/projectedMCap";

export const external_memes: Map<
  string,
  Meme & { projectedMcap: Readable<FixedNumber> }
> = new Map();

external_memes.set("token.0xshitzu.near", {
  token_id: "token.0xshitzu.near",
  owner: "shitzu.sputnik-dao.near",
  name: "SHITZU",
  symbol: "SHITZU",
  decimals: 18,
  total_supply: "306242069000000000000000000",
  total_supply_num: 306242069000000000000000000,
  pool_id: 4369,
  description:
    "We are the OG grassroots incubator of NEAR. The best hangout place in entire web3.",
  image: SHITZU_LOGO,
  telegramLink: "https://t.me/Shitzu_Community",
  twitterLink: "https://twitter.com/shitzuonnear",
  website: "https://shitzuapes.xyz",
  meme_id: -1,
  end_timestamp_ms: 1648792316000 + 1000 * 60 * 60 * 24,
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
  created_timestamp_ms: new Date(
    "Apr 01 2022 12:51:56 PM (+07:00 UTC)",
  ).getTime(),
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
  projectedMcap: readable(new FixedNumber("1000000000000000000000000000")),
});

export async function getExternalMeme(
  tokenId: string,
): Promise<(Meme & { projectedMcap: Readable<FixedNumber> }) | null> {
  const meme = external_memes.get(tokenId);
  if (!meme) {
    return null;
  }
  return {
    ...meme,
    projectedMcap: projectedMCap(meme),
  };
}
