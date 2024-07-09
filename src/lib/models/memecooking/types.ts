export type MCMemeInfo = {
  id: number;
  owner: string;
  end_timestamp_ms: number;
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

export type MCMemeInfoWithReference = MCMemeInfo & MCReference;

export type MCAccountInfo = {
  account_id: string;
  deposits: Array<[number, string]>;
  claims: Array<[string, string]>;
};
