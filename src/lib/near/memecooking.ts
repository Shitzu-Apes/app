import type {
  Action,
  FinalExecutionOutcome,
  Transaction,
} from "@near-wallet-selector/core";
import { derived, get, writable, type Writable } from "svelte/store";

import { Ft } from "./fungibleToken";
import { checkIfAccountExists } from "./rpc";
import { view } from "./utils";
import { nearWallet, Wallet, type TransactionCallbacks } from "./wallet";

import { queryClient, memecookingKeys } from "$lib/api/queries";
import type {
  MemeInfo,
  MCAccountInfo,
  MCReference,
  MemeInfoWithReference,
  Meme,
  TeamAllocation,
} from "$lib/models/memecooking";
import {
  awaitIndexerBlockHeight,
  awaitRpcBlockHeight,
} from "$lib/store/indexer";
import { FixedNumber } from "$lib/util";
import { getTokenId } from "$lib/util/getTokenId";

export abstract class MemeCooking {
  public static getLatestMeme(
    firstMemeId?: number,
  ): Promise<Array<MemeInfo | null>> {
    const promises = [...new Set([firstMemeId || 0, ...Array(50).keys()])].map(
      (id) => {
        return this.getMemeWithReference(id);
      },
    );

    return Promise.all(promises).then((res) => {
      console.log("[getLatestMeme]", res);

      return res;
    });
  }

  public static async getMemeWithReference(
    meme_id: number,
  ): Promise<MemeInfoWithReference | null> {
    const meme = await this.getMeme(meme_id);
    console.log("[getMemeWithReference]", meme, meme_id);
    if (!meme) {
      return null;
    }

    if (!meme.reference) {
      return {
        ...meme,
        description: "",
        twitterLink: "",
        telegramLink: "",
        website: "",
        image: meme.icon,
      };
    }

    const reference = (await fetch(
      `${import.meta.env.VITE_IPFS_GATEWAY}/${meme.reference}`,
    ).then((res) => res.json())) as MCReference;

    return {
      ...meme,
      ...reference,
      image: `${import.meta.env.VITE_IPFS_GATEWAY}/${reference.image}`,
    };
  }

  public static getMeme(meme_id: number): Promise<MemeInfo | null> {
    console.log("[getMeme]", import.meta.env.VITE_MEME_COOKING_CONTRACT_ID);
    return view<MemeInfo>(
      import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
      "get_meme",
      { meme_id },
    );
  }

  public static getFinalizedMeme(meme_id: number): Promise<MemeInfo | null> {
    return view<MemeInfo>(
      import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
      "get_finalized_meme",
      { meme_id },
    );
  }

  public static getMemeStakes(meme_id: number, skip?: number, limit?: number) {
    return view<Array<[string, string]> | null>(
      import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
      "get_meme_stakes",
      { meme_id, skip, limit },
    );
  }

  public static getAccount(accountId: string): Promise<MCAccountInfo | null> {
    return view<MCAccountInfo>(
      import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
      "get_account",
      { account_id: accountId },
    );
  }

  public static getUnclaimed(accountId: string): Promise<number[] | null> {
    return view<number[]>(
      import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
      "get_unclaimed",
      { account_id: accountId },
    );
  }

  public static getClaimable(
    accountId: string,
    memeId: number,
  ): Promise<string | null> {
    return view<string>(
      import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
      "get_claimable",
      { account_id: accountId, meme_id: memeId },
    );
  }

  public static isRunning(): Promise<string | null> {
    return view<string>(
      import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
      "is_running",
      {},
    );
  }

  public static async createMeme(
    wallet: Wallet,
    args: {
      durationMs: string;
      name: string;
      symbol: string;
      icon: string;
      decimals: number;
      totalSupply: string;
      reference: string;
      referenceHash: string;
      depositTokenId: string;
      softCap: string;
      hardCap?: string;
      teamAllocation?: TeamAllocation;
    },
    deposit: string,
    callback: TransactionCallbacks<FinalExecutionOutcome> = {},
  ) {
    const accountId = get(wallet.accountId$);
    if (!accountId) return;
    const [storageBalance, { account: accountCost }] = await Promise.all([
      MemeCooking.storageBalanceOf(accountId),
      MemeCooking.storageCosts(),
    ]);
    const isRegistered = !!storageBalance;

    const actions: Action[] = [];
    if (!isRegistered) {
      actions.push({
        type: "FunctionCall",
        params: {
          methodName: "storage_deposit",
          args: {},
          gas: 20_000_000_000_000n.toString(),
          deposit: accountCost,
        },
      });
    }
    actions.push({
      type: "FunctionCall",
      params: {
        methodName: "create_meme",
        args: {
          duration_ms: args.durationMs,
          name: args.name,
          symbol: args.symbol,
          icon: args.icon,
          decimals: args.decimals,
          total_supply: args.totalSupply,
          reference: args.reference,
          reference_hash: args.referenceHash,
          deposit_token_id: args.depositTokenId,
          soft_cap: args.softCap,
          hard_cap: args.hardCap,
          team_allocation: args.teamAllocation
            ? [
                args.teamAllocation.allocationBps,
                args.teamAllocation.vestingDurationMs,
                args.teamAllocation.cliffDurationMs,
              ]
            : undefined,
        },
        gas: 250_000_000_000_000n.toString(),
        deposit,
      },
    });
    return wallet.signAndSendTransaction(
      {
        receiverId: import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
        actions,
      },
      callback,
    );
  }

  public static deposit(
    wallet: Wallet,
    args: {
      memeId: number;
      amount: string;
      extraNearDeposit: string;
      referrer?: string;
    },
    callback: TransactionCallbacks<FinalExecutionOutcome[]> = {},
    needStorageDeposit: { depositAmount: string } | null = null,
    wrapNearDeposit: { depositAmount: string } | null = null,
  ) {
    const transactions: Omit<Transaction, "signerId">[] = [];

    if (needStorageDeposit) {
      transactions.push({
        receiverId: import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: "storage_deposit",
              args: {},
              gas: 30_000_000_000_000n.toString(),
              deposit: needStorageDeposit.depositAmount,
            },
          },
        ],
      });
    }

    const actions: Action[] = [];

    if (wrapNearDeposit) {
      actions.push({
        type: "FunctionCall",
        params: {
          methodName: "storage_deposit",
          args: {},
          gas: 15_000_000_000_000n.toString(),
          deposit: wrapNearDeposit.depositAmount,
        },
      });
    }

    if (args.extraNearDeposit && args.extraNearDeposit !== "0") {
      actions.push({
        type: "FunctionCall",
        params: {
          methodName: "near_deposit",
          args: {},
          gas: 15_000_000_000_000n.toString(),
          deposit: args.extraNearDeposit,
        },
      });
    }

    actions.push({
      type: "FunctionCall",
      params: {
        methodName: "ft_transfer_call",
        args: {
          receiver_id: import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
          amount: args.amount,
          msg: JSON.stringify({
            Deposit: {
              meme_id: args.memeId,
              referrer: args.referrer,
            },
          }),
        },
        gas: 100_000_000_000_000n.toString(),
        deposit: "1",
      },
    });
    transactions.push({
      receiverId: import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!,
      actions,
    });

    return wallet.signAndSendTransactions({ transactions }, callback);
  }

  public static async withdraw(
    wallet: Wallet,
    args: { memeId: number; amount: string; unwrapNear: boolean },
    callback: TransactionCallbacks<FinalExecutionOutcome[]> = {},
  ) {
    const transactions: Omit<Transaction, "signerId">[] = [];

    transactions.push({
      receiverId: import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
      actions: [
        {
          type: "FunctionCall",
          params: {
            methodName: "withdraw",
            args: {
              meme_id: args.memeId,
              amount: args.amount,
            },
            gas: 100_000_000_000_000n.toString(),
            deposit: "1",
          },
        },
      ],
    });

    if (args.unwrapNear) {
      const withdrawFee = (BigInt(args.amount) * 2n) / 100n;
      transactions.push({
        receiverId: import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID,
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: "near_withdraw",
              args: {
                amount: (BigInt(args.amount) - withdrawFee).toString(),
              },
              gas: 20_000_000_000_000n.toString(),
              deposit: "1",
            },
          },
        ],
      });
    }

    return wallet.signAndSendTransactions({ transactions }, callback);
  }

  public static async claim(
    wallet: Wallet,
    args: {
      meme: Meme;
      isWithdraw?: boolean;
      unwrapNear?: boolean;
      unwrapAmount?: string;
    },
    callback: TransactionCallbacks<FinalExecutionOutcome[]> = {},
  ) {
    const transactions: Omit<Transaction, "signerId">[] = [];
    const { meme, isWithdraw, unwrapNear, unwrapAmount } = args;

    const MIN_STORAGE_DEPOSIT = 1_250_000_000_000_000_000_000n;
    const accountId = get(wallet.accountId$);
    if (!accountId) return;

    if (!isWithdraw) {
      const tokenId = getTokenId(meme);
      const isRegistered = await Ft.isUserRegistered(tokenId, accountId);
      if (!isRegistered) {
        transactions.push({
          receiverId: tokenId,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "storage_deposit",
                args: {},
                gas: 30_000_000_000_000n.toString(),
                deposit: MIN_STORAGE_DEPOSIT.toString(),
              },
            },
          ],
        });
      }
    } else {
      const tokenId = getTokenId(meme);
      const accountExists = await checkIfAccountExists(tokenId);
      if (accountExists) {
        throw new Error("Trying to withdraw, but token exists");
      }
    }

    transactions.push({
      receiverId: import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
      actions: [
        {
          type: "FunctionCall",
          params: {
            methodName: "claim",
            args: {
              meme_id: meme.meme_id,
            },
            gas: 50_000_000_000_000n.toString(),
            deposit: "1",
          },
        },
      ],
    });

    if (unwrapNear) {
      transactions.push({
        receiverId: import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID,
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: "near_withdraw",
              args: {
                amount: unwrapAmount,
              },
              gas: 20_000_000_000_000n.toString(),
              deposit: "1",
            },
          },
        ],
      });
    }

    return wallet.signAndSendTransactions({ transactions }, callback);
  }

  public static async claimIncome(
    wallet: Wallet,
    args: { token_ids: string[] },
    hasRevenue: boolean,
    hasShitstarClaim: boolean,
    callback: TransactionCallbacks<FinalExecutionOutcome>,
  ) {
    const actions: Action[] = [];
    if (hasRevenue) {
      actions.push({
        type: "FunctionCall",
        params: {
          methodName: "claim_income",
          args: {
            token_ids: args.token_ids,
          },
          gas: 230_000_000_000_000n.toString(),
          deposit: "1",
        },
      });
    }

    if (hasShitstarClaim) {
      actions.push({
        type: "FunctionCall",
        params: {
          methodName: "claim_shitstars",
          args: {},
          gas: 70_000_000_000_000n.toString(),
          deposit: "1",
        },
      });
    }

    return wallet.signAndSendTransaction(
      {
        receiverId: import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
        actions,
      },
      callback,
    );
  }

  public static async claimVesting(
    wallet: Wallet,
    args: { meme: Meme },
    callback: TransactionCallbacks<FinalExecutionOutcome[]>,
  ) {
    const accountId = get(wallet.accountId$);
    if (!accountId) return;

    const tokenId = getTokenId(args.meme);
    const isRegistered = await Ft.isUserRegistered(tokenId, accountId);

    const transactions: Omit<Transaction, "signerId">[] = [];

    if (!isRegistered) {
      const MIN_STORAGE_DEPOSIT = 1_250_000_000_000_000_000_000n;
      transactions.push({
        receiverId: tokenId,
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: "storage_deposit",
              args: {},
              gas: 30_000_000_000_000n.toString(),
              deposit: MIN_STORAGE_DEPOSIT.toString(),
            },
          },
        ],
      });
    }

    transactions.push({
      receiverId: import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
      actions: [
        {
          type: "FunctionCall",
          params: {
            methodName: "claim_vesting",
            args: {
              meme_id: args.meme.meme_id,
            },
            gas: 100_000_000_000_000n.toString(),
            deposit: "1",
          },
        },
      ],
    });

    return wallet.signAndSendTransactions({ transactions }, callback);
  }

  public static storageCosts() {
    return view<{ account: string; perMemeDeposit: string }>(
      import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
      "storage_costs",
      {},
    );
  }

  public static createMemeStorageCost(
    sender_id: string,
    duration_ms: string,
    name: string,
    symbol: string,
    icon: string,
    decimals: number,
    total_supply: string,
    reference: string,
    reference_hash: string,
    deposit_token_id: string,
    soft_cap: string,
    hard_cap?: string,
  ): Promise<string> {
    return view<string>(
      import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
      "create_meme_storage_cost",
      {
        sender_id,
        duration_ms,
        name,
        symbol,
        icon,
        decimals,
        total_supply,
        reference,
        reference_hash,
        deposit_token_id,
        soft_cap,
        hard_cap,
      },
    );
  }

  public static requiredStake(token_id: string) {
    return view<string>(
      import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
      "required_stake",
      { token_id },
    );
  }

  public static storageBalanceOf(account_id: string) {
    return view<{
      total: string;
      available: string;
    } | null>(
      import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
      "storage_balance_of",
      { account_id },
    );
  }

  public static async checkRegister(accountId: string) {
    const [
      storageBalance,
      { account: accountCost },
      wrapNearRegistered,
      wrapNearMinDeposit,
    ] = await Promise.all([
      MemeCooking.storageBalanceOf(accountId),
      MemeCooking.storageCosts(),
      Ft.isUserRegistered(
        import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!,
        accountId,
      ),
      Ft.storageRequirement(import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!),
    ]);
    const isRegistered = !!storageBalance;

    const transactions: Omit<Transaction, "signerId">[] = [];
    if (!isRegistered) {
      transactions.push({
        receiverId: import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: "storage_deposit",
              args: {},
              gas: 30_000_000_000_000n.toString(),
              deposit: accountCost,
            },
          },
        ],
      });
    }
    if (!wrapNearRegistered) {
      transactions.push({
        receiverId: import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!,
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: "storage_deposit",
              args: {},
              gas: 15_000_000_000_000n.toString(),
              deposit: wrapNearMinDeposit,
            },
          },
        ],
      });
    }

    return transactions;
  }
}

const _mcAccount$: Writable<Promise<McAccount | undefined>> = writable(
  new Promise<never>(() => {}),
);
export const mcAccount$ = derived(_mcAccount$, (a) => a);

nearWallet.accountId$.subscribe((accountId) => {
  if (accountId) {
    updateMcAccount(accountId);
  } else {
    _mcAccount$.set(Promise.resolve(undefined));
  }
});

export async function updateMcAccount(accountId: string, blockHeight?: number) {
  if (blockHeight != null) {
    await Promise.all([
      awaitIndexerBlockHeight(blockHeight),
      awaitRpcBlockHeight(blockHeight),
    ]);
  }
  // invalidate the query
  queryClient.invalidateQueries({
    queryKey: memecookingKeys.account.base(accountId).queryKey,
  });

  queryClient.invalidateQueries({
    queryKey: memecookingKeys.account.unclaimed(accountId).queryKey,
  });

  queryClient.invalidateQueries({
    queryKey: memecookingKeys.account.profile(accountId).queryKey,
  });
}

export type McAccount = {
  account: MCAccountInfo;
  deposits: {
    meme_id: number;
    amount: string;
    meme: Meme;
  }[];
  claims: {
    token_id: string;
    amount: FixedNumber;
    meme: Meme;
  }[];
  created: Meme[];
  revenue: {
    token_id: string;
    amount: string;
  }[];
  shitstarClaim: FixedNumber;
  referralFees: FixedNumber;
  withdrawFees: FixedNumber;
};
