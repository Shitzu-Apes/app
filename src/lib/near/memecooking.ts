import { view } from "./utils";
import { Wallet, type TransactionCallbacks } from "./wallet";

import type { MCMemeInfo, MCAccountInfo } from "$lib/models/memecooking";

export abstract class MemeCooking {
  public static getLatestMeme(firstMemeId?: string): Promise<MCMemeInfo[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        let mockedData: MCMemeInfo[] = [];

        if (firstMemeId) {
          mockedData = [...mockedData];
        }

        resolve(mockedData);
      }, 1000);
    });
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
    return new Promise((resolve) => {
      setTimeout(() => {
        const deposits: MCAccountInfo["deposits"] =
          Math.random() > 0.5 ? [[0, "100000000000000000000000"]] : [];

        const mockedData = {
          account_id: accountId,
          deposits,
        };

        resolve(mockedData);
      }, 1000);
    });
  }

  public static createMeme(
    wallet: Wallet,
    args: {
      durationMs: number;
      name: string;
      symbol: string;
      icon: string;
      decimals: number;
      totalSupply: string;
      reference: string;
      referenceHash: string;
      depositTokenId: string;
    },
    callback: TransactionCallbacks = {},
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
              gas: "1200000000000000",
              deposit: "0",
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
}
