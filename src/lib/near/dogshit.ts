import { Ft } from "./fungibleToken";
import { view } from "./utils";

import type { AccountId } from "$lib/abi";
import { FixedNumber } from "$lib/util";

export abstract class Dogshit {
  public static getWhitelistedTokens() {
    return view<AccountId[]>(
      import.meta.env.VITE_DOGSHIT_CONTRACT_ID,
      "get_whitelisted_tokens",
      {},
    );
  }

  public static getUndistributedRewards() {
    return view<[AccountId, string][]>(
      import.meta.env.VITE_DOGSHIT_CONTRACT_ID,
      "get_undistributed_rewards",
      {},
    );
  }

  public static getDeposits() {
    return view<[AccountId, string][]>(
      import.meta.env.VITE_DOGSHIT_CONTRACT_ID,
      "get_deposits",
      {},
    );
  }

  public static simulateBurn(shares: string) {
    return view<[AccountId, string][]>(
      import.meta.env.VITE_DOGSHIT_CONTRACT_ID,
      "simulate_burn",
      {
        shares,
      },
    );
  }

  public static async balanceOf(accountId: string) {
    return Ft.balanceOf(
      import.meta.env.VITE_DOGSHIT_CONTRACT_ID,
      accountId,
      24,
    );
  }

  public static async totalSupply() {
    return new FixedNumber(
      await Ft.totalSupply(import.meta.env.VITE_DOGSHIT_CONTRACT_ID),
      24,
    );
  }

  public static async metadata() {
    return Ft.metadata(import.meta.env.VITE_DOGSHIT_CONTRACT_ID);
  }
}
