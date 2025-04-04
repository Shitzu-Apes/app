import { writable } from "svelte/store";

import { useNftTokensQuery } from "./nft";
import { useLeaderboardQuery } from "./rewarder";

import { FixedNumber } from "$lib/util";

export type RankingEntry = {
  token_id: string;
  account_id: string;
  score: FixedNumber;
};

export type RankingQueryResult = {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  data: RankingEntry[] | null;
};

// Helper function to extract non-staked token IDs from leaderboard data
function extractNonStakedTokenIds(
  leaderboardData: [string, [string, string | null][]][],
): string[] {
  return leaderboardData
    .flatMap(([, accounts]) => {
      return accounts
        .filter(([, accountId]) => accountId === null)
        .map(([tokenId]) => tokenId);
    })
    .filter(Boolean);
}

// Process leaderboard data into ranking entries
function processLeaderboardData(
  leaderboardData: [string, [string, string | null][]][],
  ownerMap: Record<string, string> = {},
  limit: number,
): RankingEntry[] {
  return leaderboardData
    .flatMap(([score, accounts]) =>
      accounts.map(([tokenId, accountId]) => {
        let finalAccountId = accountId;

        // Find owner for non-staked tokens
        if (accountId === null) {
          finalAccountId = ownerMap[tokenId] || "Anonymous";
        }

        return {
          token_id: tokenId,
          account_id: finalAccountId || "Anonymous",
          score: new FixedNumber(score.toString(), 18),
        };
      }),
    )
    .slice(0, limit);
}

export function useRankingQuery(limit: number = 10) {
  const leaderboardQuery = useLeaderboardQuery(limit);
  const rankingStore = writable<RankingQueryResult>({
    isLoading: true,
    isError: false,
    error: null,
    data: null,
  });

  // Update the ranking store when leaderboard data changes
  const unsubscribe = leaderboardQuery.subscribe(($leaderboardQuery) => {
    if ($leaderboardQuery.isLoading) {
      rankingStore.set({
        isLoading: true,
        isError: false,
        error: null,
        data: null,
      });
      return;
    }

    if ($leaderboardQuery.isError) {
      rankingStore.set({
        isLoading: false,
        isError: true,
        error: $leaderboardQuery.error,
        data: null,
      });
      return;
    }

    if (!$leaderboardQuery.data) {
      rankingStore.set({
        isLoading: false,
        isError: false,
        error: null,
        data: [],
      });
      return;
    }

    // Extract non-staked token IDs
    const nonStakedTokenIds = extractNonStakedTokenIds($leaderboardQuery.data);

    // If no non-staked tokens, return processed data immediately
    if (nonStakedTokenIds.length === 0) {
      const processedData = processLeaderboardData(
        $leaderboardQuery.data,
        {},
        limit,
      );
      rankingStore.set({
        isLoading: false,
        isError: false,
        error: null,
        data: processedData,
      });
      return;
    }

    // Otherwise, query non-staked tokens
    const nonStakedQueries = useNftTokensQuery({
      fromIndex: "0",
      limit: 1000,
    });

    // Create a subscriber to handle the results
    const nonStakedUnsubscribe = nonStakedQueries.subscribe(
      ($nonStakedQueries) => {
        // Create a map of token ID to owner ID
        const ownerMap: Record<string, string> = {};
        $nonStakedQueries.data?.forEach((query) => {
          if (query.token_id && query.owner_id) {
            ownerMap[query.token_id] = query.owner_id;
          }
        });

        // Process the leaderboard data with owner information
        const processedData = processLeaderboardData(
          $leaderboardQuery.data,
          ownerMap,
          limit,
        );

        rankingStore.set({
          isLoading: false,
          isError: false,
          error: null,
          data: processedData,
        });
      },
    );

    // Cleanup this subscription when leaderboard changes
    return () => {
      nonStakedUnsubscribe();
    };
  });

  // Return a derived store to clean up subscriptions
  return {
    subscribe: (run: (value: RankingQueryResult) => void) => {
      const innerUnsubscribe = rankingStore.subscribe(run);
      return () => {
        innerUnsubscribe();
        unsubscribe();
      };
    },
  };
}
