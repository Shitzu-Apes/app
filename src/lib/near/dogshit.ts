import { Ft } from "./fungibleToken";
import { view } from "./utils";

import type { AccountId } from "$lib/abi";

export abstract class Dogshit {
  // export interface DogshitContract extends Contract {
  //   get_whitelisted_tokens: ContractViewCall<undefined, AccountId[]>;
  //   get_undistributed_rewards: ContractViewCall<undefined, [AccountId, string][]>;
  //   get_deposits: ContractViewCall<undefined, [AccountId, string][]>;
  //   simulate_burn: ContractViewCall<
  //     {
  //       shares: string;
  //     },
  //     [AccountId, string][]
  //   >;

  //   ft_balance_of: ContractViewCall<
  //     {
  //       account_id: string;
  //     },
  //     string
  //   >;
  //   ft_total_supply: ContractViewCall<undefined, string>;
  //   ft_metadata: ContractViewCall<undefined, FungibleTokenMetadata>;
  // }
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
    return Ft.totalSupply(import.meta.env.VITE_DOGSHIT_CONTRACT_ID);
  }

  public static async metadata() {
    return Ft.metadata(import.meta.env.VITE_DOGSHIT_CONTRACT_ID);
  }
}
