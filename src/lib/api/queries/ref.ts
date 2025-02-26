import { createQueryKeys } from "@lukemorales/query-key-factory";
import { createQuery } from "@tanstack/svelte-query";

import { queryClient } from ".";

import { Ref } from "$lib/near";
import type { PoolInfo } from "$lib/near/ref";

export const ref = createQueryKeys("ref", {
  all: () => ({
    queryKey: ["pools"],
    queryFn: async () => {
      let promises = [];
      const poolsWithIndex: { pool: PoolInfo; index: number }[] = [];
      let doBreak = false;
      for (let i = 0; i < 100_000; i += 1_000) {
        const poolPromise = Ref.getPools(i, 1_000).then((newPools) => {
          poolsWithIndex.push(
            ...newPools.map((pool, idx) => ({
              pool,
              index: i + idx,
            })),
          );
          if (newPools.length < 1_000) {
            doBreak = true;
          }
        });
        promises.push(poolPromise);
        if (promises.length >= 5) {
          await Promise.all(promises);
          promises = [];
          if (doBreak) break;
        }
      }

      // Sort by index and extract just the pools
      const pools = poolsWithIndex
        .sort((a, b) => a.index - b.index)
        .map((p) => p.pool);

      return pools;
    },
  }),
  byIds: (poolIds: number[]) => ({
    queryKey: [{ poolIds }],
    queryFn: () => Ref.getPoolByIds(poolIds),
  }),
  detail: (poolId: number) => ({
    queryKey: [{ poolId }],
    queryFn: () => Ref.getPool(poolId),
  }),
  shares: (params: { poolId: number; accountId: string }) => ({
    queryKey: [{ params }],
    queryFn: () => Ref.getPoolShares(params.poolId, params.accountId),
  }),
  hasRegistered: (params: { poolId: number; accountId: string }) => ({
    queryKey: [{ params }],
    queryFn: () => Ref.mftHasRegistered(params.poolId, params.accountId),
  }),
});

export function useRefPoolsQuery() {
  return createQuery({
    ...ref.all(),
    staleTime: 1000 * 60, // 1 minute
  });
}

export function createRefGetPoolQuery(poolId: number) {
  const allPools = queryClient.getQueryData(ref.all().queryKey) as PoolInfo[];
  // make sure poolId is a valid index of allPools
  let initialData: PoolInfo | null = null;
  if (poolId < 0 || poolId >= allPools.length) {
    initialData = null;
  } else {
    initialData = allPools[poolId];
  }

  return createQuery({
    ...ref.detail(poolId),
    initialData,
    staleTime: 1000 * 60, // 1 minute
  });
}
