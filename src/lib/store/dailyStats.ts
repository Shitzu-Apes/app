import { writable } from "svelte/store";

import { client } from "$lib/api/client";

export interface DailyStats {
  date: string;
  total_memes: number;
  total_launched_memes: number;
  total_finalized_memes: number;
}

export interface TokenStats {
  date: string;
  token_id: string;
  total_volume?: string | null;
  total_deposits?: string | null;
  total_withdrawals?: string | null;
  total_protocol_fees?: string | null;
  total_referral_fees?: string | null;
  total_withdraw_fees?: string | null;
  last_change_ms: number | null;
}

interface DailyStatsState {
  memeStats: DailyStats[];
  tokenStats: TokenStats[];
  loading: boolean;
  error: string | null;
}

const initialState: DailyStatsState = {
  memeStats: [],
  tokenStats: [],
  loading: false,
  error: null,
};

function createDailyStatsStore() {
  const { subscribe, set, update } = writable<DailyStatsState>(initialState);

  return {
    subscribe,
    fetchStats: async () => {
      update((state) => ({ ...state, loading: true, error: null }));

      try {
        const [memeStatsResponse, tokenStatsResponse] = await Promise.all([
          client.GET("/info/daily-stats"),
          client.GET("/info/daily-token-stats"),
        ]);

        if ("error" in memeStatsResponse || "error" in tokenStatsResponse) {
          throw new Error("Failed to fetch daily stats");
        }

        const memeStats = memeStatsResponse.data;
        const tokenStats = tokenStatsResponse.data;

        update((state) => ({
          ...state,
          memeStats,
          tokenStats,
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

export const dailyStatsStore = createDailyStatsStore();
