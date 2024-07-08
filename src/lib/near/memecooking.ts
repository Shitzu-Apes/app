import type { HereCall } from "@here-wallet/core";
import type { FinalExecutionOutcome } from "@near-wallet-selector/core";

import { view } from "./utils";
import { Wallet, type TransactionCallbacks } from "./wallet";

import type { MCMemeInfo, MCAccountInfo } from "$lib/models/memecooking";

export abstract class MemeCooking {
  public static getLatestMeme(_firstMemeId?: string): Promise<MCMemeInfo[]> {
    const promises = [...Array(10).keys()].map((id) => {
      return view<MCMemeInfo>(
        import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
        "get_meme",
        { id },
      );
    });

    return Promise.all(promises);
  }

  public static getMeme(id: string): Promise<MCMemeInfo | null> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockedData: MCMemeInfo = {
          id,
          owner: "shitzu.near",
          end_timestamp_ms: Date.now() + 1000,
          name: "shhh",
          symbol: "SHHH",
          icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABKklEQVR42mNk",
          decimals: 18,
          total_supply: "100000000000000000000000000",
          banner:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAABKklEQVR42mNk",
          deposit_token_id: "wrap.near",
          description: "Shitzu is a meme token.",
          links: [["https://twitter.com/shitzuonnear", ""]],
        };

        resolve(mockedData);
      }, 1000);
    });
  }

  public static getAccount(accountId: string): Promise<MCAccountInfo | null> {
    return view<MCAccountInfo>(
      import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
      "get_account",
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
    args: { memeId: number; amount: string },
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

    actions.push({
      type: "FunctionCall",
      params: {
        methodName: "near_deposit",
        args: {},
        gas: 30_000_000_000_000n.toString(),
        deposit: args.amount,
      },
    });

    transactions.push({
      receiverId: import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!,
      actions,
    });

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

  public static storageBalanceBounds() {
    return view<{ min: string; max: string }>(
      import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
      "storage_balance_bounds",
      {},
    );
  }

  public static storageBalanceOf(account_id: string) {
    return view<string | null>(
      import.meta.env.VITE_MEME_COOKING_CONTRACT_ID,
      "storage_balance_of",
      { account_id },
    );
  }
}
