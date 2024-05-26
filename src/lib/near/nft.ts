import { view } from "./utils";

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
}
