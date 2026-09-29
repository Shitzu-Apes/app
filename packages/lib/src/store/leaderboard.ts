import { writable } from "svelte/store";

import { client } from "$lib/api/client";

interface LeaderboardEntry {
  account_id: string;
  referral_fees?: string;
  withdraw_fees?: string;
}

interface LeaderboardState {
  referralLeaderboard: LeaderboardEntry[];
  withdrawLeaderboard: LeaderboardEntry[];
  loading: boolean;
  error: string | null;
}

const initialState: LeaderboardState = {
  referralLeaderboard: [],
  withdrawLeaderboard: [],
  loading: false,
  error: null,
};

function createLeaderboardStore() {
  const { subscribe, set, update } = writable<LeaderboardState>(initialState);

  return {
    subscribe,
    fetchLeaderboards: async () => {
      update((state) => ({ ...state, loading: true, error: null }));

      try {
        const [referralResponse, withdrawResponse] = await Promise.all([
          client.GET("/leaderboard/referral"),
          client.GET("/leaderboard/withdraw"),
        ]);

        if ("error" in referralResponse || "error" in withdrawResponse) {
          throw new Error("Failed to fetch leaderboard data");
        }

        const referralData = referralResponse.data;
        const withdrawData = withdrawResponse.data;

        update((state) => ({
          ...state,
          referralLeaderboard: referralData,
          withdrawLeaderboard: withdrawData,
          loading: false,
        }));
      } catch (error) {
        update((state) => ({
          ...state,
          loading: false,
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
        }));
      }
    },
    reset: () => set(initialState),
  };
}

export const leaderboardStore = createLeaderboardStore();
