import { view } from "./utils";

export type Token = {
  token_id: string;
  owner_id: string;
  metadata: {
    title: string | null;
    description: string | null;
    media: string | null;
    media_hash: string | null;
    copies: number | null;
    issued_at: string | null;
    expires_at: string | null;
    starts_at: string | null;
    updated_at: string | null;
    extra: string | null;
    reference: string | null;
    reference_hash: string | null;
  } | null;
  approved_account_ids: Record<string, number> | null;
};

export abstract class Nft {
  public static nftSupplyForOwner(accountId: string) {
    const count = view<number>(
      import.meta.env.VITE_NFT_CONTRACT_ID,
      "nft_supply_for_owner",
      {
        account_id: accountId,
      },
    );

    return count;
  }

  public static nftTokensForOwner(accountId: string) {
    const tokens = view<Token[]>(
      import.meta.env.VITE_NFT_CONTRACT_ID,
      "nft_tokens_for_owner",
      {
        account_id: accountId,
      },
    );

    return tokens;
  }

  public static nftToken(tokenId: string) {
    const token = view<Token>(
      import.meta.env.VITE_NFT_CONTRACT_ID,
      "nft_token",
      {
        token_id: tokenId,
      },
    );

    return token;
  }
}
