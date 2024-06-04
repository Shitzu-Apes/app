import { view } from "./utils";

export abstract class Rewarder {
  public static primaryNftOf(accountId: string) {
    return view<[string, string]>(
      import.meta.env.VITE_REWARDER_CONTRACT_ID,
      "primary_nft_of",
      {
        account_id: accountId,
      },
    );
  }
}
