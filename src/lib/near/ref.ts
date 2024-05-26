import { FixedNumber } from "@tarnadas/fixed-number";

import { view } from "./utils";

/**
 *  /// Pool kind.
    pub pool_kind: String,
    /// List of tokens in the pool.
    pub token_account_ids: Vec<AccountId>,
    /// How much NEAR this contract has.
    pub amounts: Vec<U128>,
    /// Fee charged for swap.
    pub total_fee: u32,
    /// Total number of shares.
    pub shares_total_supply: U128,
    pub amp: u64,
 */
export type PoolInfo = {
  pool_kind: string;
  token_account_ids: string[];
  amounts: string[];
  total_fee: number;
  shares_total_supply: string;
  amp: number;
};

export abstract class Ref {
  public static getPoolByIds(poolIds: number[]) {
    return view<PoolInfo[]>("v2.ref-finance.near", "get_pool_by_ids", {
      pool_ids: poolIds,
    });
  }

  public static async calculateShitzuOut(
    nearIn: FixedNumber,
  ): Promise<FixedNumber> {
    const args = {
      pool_id: 4369,
      token_in: "wrap.near",
      amount_in: nearIn.toU128(),
      token_out: "token.0xshitzu.near",
    };

    const shitzuOut = await view<string>(
      "v2.ref-finance.near",
      "get_return",
      args,
    );

    return new FixedNumber(shitzuOut, 18);
  }
}
