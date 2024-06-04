import { view } from "./utils";

export abstract class Rewarder {
  public static primaryNftOf(accountId: string) {
    return view<[string, string] | null>(
      import.meta.env.VITE_REWARDER_CONTRACT_ID,
      "primary_nft_of",
      {
        account_id: accountId,
      },
    );
  }

  public static getLeaderboard(limit?: number) {
    return view<[string, [string, string | null][]][]>(
      import.meta.env.VITE_REWARDER_CONTRACT_ID,
      "get_leaderboard",
      { limit },
    );
  }
}
