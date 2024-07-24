import type { HereCall } from "@here-wallet/core";
import type { FinalExecutionOutcome } from "@near-wallet-selector/core";

import { view } from "./utils";
import { Wallet, type TransactionCallbacks } from "./wallet";

import type {
  MCMemeInfo,
  MCAccountInfo,
  MCMemeInfoWithReference,
  MCReference,
} from "$lib/models/memecooking";

export abstract class MemeCooking {
  public static getLatestMeme(
    firstMemeId?: number,
  ): Promise<Array<MCMemeInfoWithReference | null>> {
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
  ): Promise<MCMemeInfoWithReference | null> {
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
        image: meme.image,
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

  public static getMeme(meme_id: number): Promise<MCMemeInfo | null> {
    return view<MCMemeInfo>(
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

  public static getAccountStakes(
    accountId: string,
  ): Promise<Array<[number, string]> | null> {
    return view<Array<[number, string]>>(
      import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
      "get_account_stakes",
      { account_id: accountId },
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
              gas: "300000000000000",
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
    args: { memeId: number; amount: string; extraNearDeposit: string },
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
              gas: "300000000000000",
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
          gas: "300000000000000",
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
          gas: 30_000_000_000_000n.toString(),
          deposit: args.extraNearDeposit,
        },
      });
    }

    if (actions.length > 0) {
      transactions.push({
        receiverId: import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!,
        actions,
      });
    }

    transactions.push({
      receiverId: import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!,
      actions: [
        {
          type: "FunctionCall",
          params: {
            methodName: "ft_transfer_call",
            args: {
              receiver_id: import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
              amount: args.amount,
              msg: JSON.stringify({
                Deposit: {
                  meme_id: args.memeId,
                },
              }),
            },
            gas: "300000000000000",
            deposit: "1",
          },
        },
      ],
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
              gas: "300000000000000",
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
    args: { token_ids: string[] },
    callback: TransactionCallbacks<FinalExecutionOutcome> = {},
  ) {
    return wallet.signAndSendTransaction(
      {
        receiverId: import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: "claim",
              args,
              gas: "300000000000000",
              deposit: "1",
            },
          },
        ],
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
}
