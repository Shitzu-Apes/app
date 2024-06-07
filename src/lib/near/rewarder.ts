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

  public static stakerOf(tokenId: string) {
    const staker = view<string | null>(
      import.meta.env.VITE_REWARDER_CONTRACT_ID,
      "staker_of",
      {
        token_id: tokenId,
      },
    );

    return staker;
  }

  public static scoreOf(tokenId: string) {
    const score = view<string>(
      import.meta.env.VITE_REWARDER_CONTRACT_ID,
      "score_of",
      {
        token_id: tokenId,
      },
    );

    return score;
  }
}
