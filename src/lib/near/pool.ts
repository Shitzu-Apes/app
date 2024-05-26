import { view } from "./utils";

import type { AccountId } from "$lib/abi";

export type PoolFarm = {
  farm_id: number;
  name: string;
  token_id: AccountId;
  amount: string;
  start_date: string;
  end_date: string;
  active: boolean;
};

export type PoolAccount = {
  account_id: AccountId;
  unstaked_balance: string;
  staked_balance: string;
  can_withdraw: boolean;
};

export type PoolSummary = {
  owner: AccountId;
  total_staked_balance: string;
};

export abstract class Pool {
  public static getFarm(farmId: number) {
    return view<PoolFarm>(
      import.meta.env.VITE_VALIDATOR_CONTRACT_ID,
      "get_farm",
      {
        farm_id: farmId,
      },
    );
  }

  public static getAccount(accountId: string) {
    return view<PoolAccount>(
      import.meta.env.VITE_VALIDATOR_CONTRACT_ID,
      "get_account",
      {
        account_id: accountId,
      },
    );
  }

  public static getNumberOfAccounts() {
    return view<number>(
      import.meta.env.VITE_VALIDATOR_CONTRACT_ID,
      "get_number_of_accounts",
      {},
    );
  }

  public static getPoolSummary() {
    return view<PoolSummary>(
      import.meta.env.VITE_VALIDATOR_CONTRACT_ID,
      "get_pool_summary",
      {},
    );
  }
}
