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

export const contract$ = derived(near$, async (n) => {
  const [near, Account, Contract] = await n;
  const account = new Account(
    near.connection,
    import.meta.env.VITE_CONTRACT_ID,
  );
  return new Contract(account, import.meta.env.VITE_CONTRACT_ID, {
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

export * from "./wallet";
