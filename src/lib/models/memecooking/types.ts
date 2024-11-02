import type { Readable } from "svelte/store";

import type { Meme as MemeType } from "$lib/api/client";
import type { FixedNumber } from "$lib/util";

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
  soft_cap: string;
  hard_cap?: string;
  team_allocation?: {
    amount: number;
    vesting_duration_ms: number;
    cliff_duration_ms: number;
  };
  vesting?: {
    already_claimed: string;
    last_claim_ms: string;
  };
  pool_amount: string;
  amount_to_be_distributed: string;
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

export type Meme = MemeType & {
  projectedMcap?: Readable<FixedNumber>;
  animate?: boolean;
};

export type MemeInfoWithReference = MemeInfo & MCReference;

export type MCAccountInfo = {
  account_id: string;
  deposits: Array<[number, string]>;
  income: Array<[string, string]>;
  shitstar_claim: string;
};

export type TeamAllocation = {
  allocationBps: number;
  vestingDurationMs: number;
  cliffDurationMs: number;
};
