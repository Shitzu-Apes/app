import { view } from "./utils";

import { FixedNumber } from "$lib/util";

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
  public static async getPools(fromIndex: number, limit: number) {
    const pools = await view<PoolInfo[]>(
      import.meta.env.VITE_REF_CONTRACT_ID,
      "get_pools",
      {
        from_index: fromIndex,
        limit,
      },
    );

    return pools;
  }

  public static async getPoolByIds(poolIds: number[]) {
    const pools = await view<PoolInfo[]>(
      import.meta.env.VITE_REF_CONTRACT_ID,
      "get_pool_by_ids",
      {
        pool_ids: poolIds,
      },
    );

    return pools;
  }

  public static async getReturn({
    poolId,
    tokenIn,
    amountIn,
    tokenOut,
    decimals,
  }: {
    poolId: number;
    tokenIn: string;
    amountIn: FixedNumber;
    tokenOut: string;
    decimals: number;
  }) {
    const args = {
      pool_id: poolId,
      token_in: tokenIn,
      amount_in: amountIn.toU128(),
      token_out: tokenOut,
    };
    console.log("args", args);
    const out = await view<string>(
      import.meta.env.VITE_REF_CONTRACT_ID,
      "get_return",
      args,
    );

    return new FixedNumber(out, decimals);
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
      import.meta.env.VITE_REF_CONTRACT_ID,
      "get_return",
      args,
    );

    return new FixedNumber(shitzuOut, 18);
  }

  public static async getPool(poolId: number): Promise<PoolInfo> {
    const pool = await view<PoolInfo>(
      import.meta.env.VITE_REF_CONTRACT_ID,
      "get_pool",
      {
        pool_id: poolId,
      },
    );

    return pool;
  }

  public static async getPoolShares(poolId: number, accountId: string) {
    return view<string>(
      import.meta.env.VITE_REF_CONTRACT_ID,
      "get_pool_shares",
      {
        pool_id: poolId,
        account_id: accountId,
      },
    );
  }

  public static async mftHasRegistered(
    poolId: number,
    accountId: string,
  ): Promise<boolean> {
    return view<boolean>(
      import.meta.env.VITE_REF_CONTRACT_ID,
      "mft_has_registered",
      {
        token_id: `:${poolId}`,
        account_id: accountId,
      },
    );
  }
}

export type FarmerSeed = {
  free_amount: string;
};

export abstract class MemeFarmXRefShitzu {
  public static getFarmerSeed(farmerId: string, seedId: string) {
    return view<FarmerSeed | null>(
      "memefarm-xref-shitzu.ref-labs.near",
      "get_farmer_seed",
      {
        farmer_id: farmerId,
        seed_id: seedId,
      },
    );
  }
}

export abstract class MemeFarmShitzu {
  public static getFarmerSeed(farmerId: string, seedId: string) {
    return view<FarmerSeed | null>(
      "meme-farming_011.ref-labs.near",
      "get_farmer_seed",
      {
        farmer_id: farmerId,
        seed_id: seedId,
      },
    );
  }
}

export abstract class LPFarm {
  public static getFarmerSeed(farmerId: string, seedId: string) {
    return view<FarmerSeed | null>(
      "boostfarm.ref-labs.near",
      "get_farmer_seed",
      {
        farmer_id: farmerId,
        seed_id: seedId,
      },
    );
  }
}
