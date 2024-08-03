import type { Meme as MemeType } from "$lib/api/client";

export type MemeInfo = {
  id: number;
  owner: string;
  end_timestamp_ms: string;
  name: string;
  symbol: string;
  icon: string;
  decimals: number;
  total_supply: string;
  reference: string;
  reference_hash: string;
  deposit_token_id: string;
  total_staked: string;
  total_withdrawal_fees: string;
};

export type MCReference = {
  description: string;
  twitterLink: string;
  telegramLink: string;
  website: string;
  image: string;
};

export type Meme = MemeType;

export type MemeInfoWithReference = MemeInfo & MCReference;

export type MCAccountInfo = {
  account_id: string;
  deposits: Array<[number, string]>;
  income: Array<[string, string]>;
  shitstar_claim: string;
};
