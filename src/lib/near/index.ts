import type { ConnectConfig, Contract } from "near-api-js";
import type { ContractMethods } from "near-api-js/lib/contract";
import { derived, readable } from "svelte/store";

import type { AccountId, FungibleTokenMetadata } from "$lib/abi";
import type { ContractViewCall } from "$lib/models";

const nearConfig = {
  networkId: import.meta.env.VITE_NETWORK_ID,
  nodeUrl: import.meta.env.VITE_NODE_URL,
  walletUrl: import.meta.env.VITE_WALLET_URL,
  helperUrl: import.meta.env.VITE_HELPER_URL,
} as const satisfies ConnectConfig;

export const near$ = readable(
  import("near-api-js").then(({ connect, Account, Contract }) =>
    connect(nearConfig).then((near) => [near, Account, Contract] as const),
  ),
);

export const dogshitContract$ = derived(near$, async (n) => {
  const [near, Account, Contract] = await n;
  const account = new Account(
    near.connection,
    import.meta.env.VITE_DOGSHIT_CONTRACT_ID,
  );
  return new Contract(account, import.meta.env.VITE_DOGSHIT_CONTRACT_ID, {
    viewMethods: [
      "get_whitelisted_tokens",
      "get_undistributed_rewards",
      "get_deposits",
      "simulate_burn",
      "ft_balance_of",
      "ft_total_supply",
      "ft_metadata",
    ],
    changeMethods: [],
    useLocalViewExecution: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } satisfies ContractMethods as any) as DogshitContract;
});

export interface DogshitContract extends Contract {
  get_whitelisted_tokens: ContractViewCall<undefined, AccountId[]>;
  get_undistributed_rewards: ContractViewCall<undefined, [AccountId, string][]>;
  get_deposits: ContractViewCall<undefined, [AccountId, string][]>;
  simulate_burn: ContractViewCall<
    {
      shares: string;
    },
    [AccountId, string][]
  >;

  ft_balance_of: ContractViewCall<
    {
      account_id: string;
    },
    string
  >;
  ft_total_supply: ContractViewCall<undefined, string>;
  ft_metadata: ContractViewCall<undefined, FungibleTokenMetadata>;
}

export const validatorContract$ = derived(near$, async (n) => {
  const [near, Account, Contract] = await n;
  const account = new Account(
    near.connection,
    import.meta.env.VITE_VALIDATOR_CONTRACT_ID,
  );
  return new Contract(account, import.meta.env.VITE_VALIDATOR_CONTRACT_ID, {
    viewMethods: ["get_farm", "get_account"],
    changeMethods: [],
    useLocalViewExecution: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } satisfies ContractMethods as any) as ValidatorContract;
});

export interface ValidatorContract extends Contract {
  get_farm: ContractViewCall<{ farm_id: number }, ValidatorFarm>;
  get_account: ContractViewCall<{ account_id: string }, ValidatorAccount>;
}

export type ValidatorFarm = {
  farm_id: number;
  name: string;
  token_id: AccountId;
  amount: string;
  start_date: string;
  end_date: string;
  active: boolean;
};

export type ValidatorAccount = {
  account_id: AccountId;
  unstaked_balance: string;
  staked_balance: string;
  can_withdraw: boolean;
};

export * from "./wallet";
