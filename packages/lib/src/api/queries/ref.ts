import { createQueryKeys } from "@lukemorales/query-key-factory";

import { Ref } from "$lib/near";

export const ref = createQueryKeys("ref", {
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
