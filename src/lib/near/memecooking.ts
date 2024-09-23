import type { HereCall } from "@here-wallet/core";
import type { Action, FinalExecutionOutcome } from "@near-wallet-selector/core";
import { derived, writable } from "svelte/store";

import { Ft } from "./fungibleToken";
import { view } from "./utils";
import { wallet, Wallet, type TransactionCallbacks } from "./wallet";

import type {
  MemeInfo,
  MCAccountInfo,
  MCReference,
  MemeInfoWithReference,
} from "$lib/models/memecooking";
import { FixedNumber } from "$lib/util";

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
    return view<MemeInfo>(
      import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
      "get_meme",
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

  public static createMeme(
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
    },
    deposit: string,
    callback: TransactionCallbacks<FinalExecutionOutcome> = {},
  ) {
    return wallet.signAndSendTransaction(
      {
        receiverId: import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
        actions: [
          {
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
              },
              gas: 270_000_000_000_000n.toString(),
              deposit,
            },
          },
        ],
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
    const transactions: HereCall[] = [];

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

    const actions: HereCall["actions"] = [];

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
    args: { memeId: number; amount: string },
    callback: TransactionCallbacks<FinalExecutionOutcome> = {},
  ) {
    return wallet.signAndSendTransaction(
      {
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
      },
      callback,
    );
  }

  public static async claim(
    wallet: Wallet,
    args: { meme_ids: number[]; token_ids: string[] },
    callback: TransactionCallbacks<FinalExecutionOutcome[]> = {},
  ) {
    const transactions: HereCall[] = [];

    const MIN_STORAGE_DEPOSIT = 1250000000000000000000n;

    for (const token_id of args.token_ids) {
      transactions.push({
        receiverId: token_id,
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
            methodName: "claim",
            args: {
              meme_ids: args.meme_ids,
            },
            gas: 50_000_000_000_000n.toString(),
            deposit: "1",
          },
        },
      ],
    });

    return wallet.signAndSendTransactions({ transactions }, callback);
  }

  public static async claimIncome(
    wallet: Wallet,
    args: { token_ids: string[] },
    hasRevenue: boolean,
    hasShitstarClaim: boolean,
    callback: TransactionCallbacks<FinalExecutionOutcome> = {},
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

    const transactions: HereCall[] = [];
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

export const requiredStake = MemeCooking.requiredStake(
  import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!,
).then((requiredStake) => new FixedNumber(requiredStake, 24));

const _mcAccount$ = writable<MCAccountInfo | null>();
export const mcAccount$ = derived(_mcAccount$, (a) => a);

export async function updateMcAccount(accountId: string) {
  const account = await MemeCooking.getAccount(accountId);
  _mcAccount$.set(account);
}

wallet.accountId$.subscribe((accountId) => {
  if (accountId) {
    updateMcAccount(accountId);
  } else {
    _mcAccount$.set(null);
  }
});
