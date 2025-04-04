import { createQueryKeys } from "@lukemorales/query-key-factory";
import { createQuery } from "@tanstack/svelte-query";

import { Rewarder } from "$lib/near";

export const rewarder = createQueryKeys("rewarder", {
  primaryNft: (accountId: string) => ({
    queryKey: [{ accountId }],
    queryFn: () => Rewarder.primaryNftOf(accountId),
  }),
  leaderboard: (limit?: number) => ({
    queryKey: [{ limit }],
    queryFn: () => Rewarder.getLeaderboard(limit),
  }),
  stakerOf: (tokenId: string) => ({
    queryKey: [{ tokenId }],
    queryFn: () => Rewarder.stakerOf(tokenId),
  }),
  scoreOf: (tokenId: string) => ({
    queryKey: [{ tokenId }],
    queryFn: () => Rewarder.scoreOf(tokenId),
  }),
});

export function usePrimaryNftQuery(accountId: string) {
  return createQuery({
    ...rewarder.primaryNft(accountId),
    enabled: !!accountId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useLeaderboardQuery(limit?: number) {
  return createQuery({
    ...rewarder.leaderboard(limit),
    staleTime: 1000 * 60, // 1 minute
  });
}

export function useStakerOfQuery(tokenId: string) {
  return createQuery({
    ...rewarder.stakerOf(tokenId),
    enabled: !!tokenId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useScoreOfQuery(tokenId: string) {
  return createQuery({
    ...rewarder.scoreOf(tokenId),
    enabled: !!tokenId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
