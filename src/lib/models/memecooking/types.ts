export type MCMemeInfo = {
  id: string;
  owner: string;
  end_timestamp_ms: number;
  name: string;
  symbol: string;
  icon: string | null;
  decimals: number;
  total_supply: string;
  banner: string | null;
  deposit_token_id: string;
  description: string | null;
  links: Array<[string, string]>;
};

export type MCAccountInfo = {
  account_id: string;
  deposits: Array<[number, string]>;
};
