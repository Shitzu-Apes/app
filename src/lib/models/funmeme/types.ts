// declare types for memecooking module
export type MemeBid = {
  id: string;
  name: string;
  ticker: string;
  icon: string;
  created_by: string;
  created_at: number;
  duration: number;
};

export type MemeBidAccountInfo = {
  account_id: string;
  deposits: Array<[number, string]>;
};
