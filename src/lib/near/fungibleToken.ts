import { view } from "./utils";

import type { FungibleTokenMetadata } from "$lib/abi";
import { FixedNumber } from "$lib/util";

const tokenMetadataCache: Record<string, FungibleTokenMetadata> = {};

export abstract class Ft {
  public static async balanceOf(
    tokenId: string,
    accountId: string,
    decimals: number,
  ) {
    const balance = await view<string>(tokenId, "ft_balance_of", {
      account_id: accountId,
    });

    return new FixedNumber(balance, decimals);
  }

  public static async totalSupply(tokenId: string) {
    return view<string>(tokenId, "ft_total_supply", {});
  }

  public static async metadata(tokenId: string) {
    if (tokenMetadataCache[tokenId] != null) {
      return tokenMetadataCache[tokenId];
    }
    const metadata = await view<FungibleTokenMetadata>(
      tokenId,
      "ft_metadata",
      {},
    );
    tokenMetadataCache[tokenId] = metadata;
    return metadata;
  }

  public static async isUserRegistered(
    tokenId: string,
    accountId: string,
  ): Promise<boolean> {
    const storageBalance = await view(tokenId, "storage_balance_of", {
      account_id: accountId,
    });

    return storageBalance != null;
  }

  public static async storageRequirement(tokenId: string): Promise<string> {
    const storageRequestment = await view<{ min: string }>(
      tokenId,
      "storage_balance_bounds",
      {},
    );
    return storageRequestment.min;
  }
}
