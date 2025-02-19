import { createQueryKeyStore } from "@lukemorales/query-key-factory";
import { createQuery } from "@tanstack/svelte-query";
import { derived, type Readable } from "svelte/store";

import { client } from "../client";

import { memesQueryFactory } from "./memes";

import type { Meme } from "$lib/models/memecooking";
import { MemeCooking } from "$lib/near/memecooking";
import {
  awaitIndexerBlockHeight,
  awaitRpcBlockHeight,
} from "$lib/store/indexer";
import { FixedNumber } from "$lib/util";
import { getTokenId } from "$lib/util/getTokenId";
import { projectedPoolStats } from "$lib/util/projectedMCap";
import {
  sortMemeByEndtimestamp,
  sortMemeByUnclaimedThenEndTimestamp,
} from "$lib/util/sortMemeByCreatedAt";

type ProfileData = {
  accountId: string;
  deposited: { meme_id: number; account_id: string; balance?: string | null }[];
  created: { meme_id: number }[];
  referral_fees: string;
  withdraw_fees: string;
};

export const memecookingKeys = createQueryKeyStore({
  account: {
    base: (accountId: string, blockHeight?: number) => ({
      queryKey: ["memecooking", "account", accountId, blockHeight],
      queryFn: () => MemeCooking.getAccount(accountId),
    }),
    storageBalance: (accountId: string) => ({
      queryKey: ["memecooking", "storage", accountId],
      queryFn: () => MemeCooking.storageBalanceOf(accountId),
    }),
    storageCosts: () => ({
      queryKey: ["memecooking", "storageCosts"],
      queryFn: () => MemeCooking.storageCosts(),
    }),
    unclaimed: (accountId: string, blockHeight?: number) => ({
      queryKey: ["memecooking", "unclaimed", accountId, blockHeight],
      queryFn: async () => {
        const memesIds = await MemeCooking.getUnclaimed(accountId);
        console.log("[unclaimed::memesIds]", memesIds);
        if (!memesIds || memesIds.length === 0) return [];

        const unclaimedAmounts = await Promise.all(
          memesIds.map((memeId) => MemeCooking.getClaimable(accountId, memeId)),
        );

        console.log("[unclaimedAmounts]", unclaimedAmounts);

        return unclaimedAmounts
          .map((amount, index) => ({
            meme_id: memesIds[index],
            amount,
          }))
          .filter(({ amount }) => amount != null);
      },
    }),
    profile: (accountId: string, blockHeight?: number) => ({
      queryKey: ["memecooking", "profile", accountId, blockHeight],
      queryFn: async () => {
        if (blockHeight != null) {
          await Promise.all([
            awaitIndexerBlockHeight(blockHeight),
            awaitRpcBlockHeight(blockHeight),
          ]);
        }

        const res = await client.GET(`/profile/{accountId}`, {
          params: {
            path: {
              accountId,
            },
            headers:
              blockHeight != null
                ? {
                    "X-Block-Height": String(blockHeight),
                  }
                : {},
          },
        });

        if (!res.data) {
          throw new Error(`[Profile] Account ${accountId} not found`);
        }
        return res.data as ProfileData;
      },
    }),
  },
});

export function useMcBaseAccountQuery(accountId: string, blockHeight?: number) {
  return createQuery({
    ...memecookingKeys.account.base(accountId, blockHeight),
    enabled: !!accountId,
  });
}

export function useMcUnclaimedQuery(accountId: string, blockHeight?: number) {
  return createQuery({
    ...memecookingKeys.account.unclaimed(accountId, blockHeight),
    enabled: !!accountId,
  });
}

export function useMcProfileQuery(accountId: string, blockHeight?: number) {
  return createQuery({
    ...memecookingKeys.account.profile(accountId, blockHeight),
    enabled: !!accountId,
  });
}

export function useMcStorageBalanceQuery(accountId: string) {
  return createQuery({
    ...memecookingKeys.account.storageBalance(accountId),
    enabled: !!accountId,
  });
}

export function useMcReferrerStorageBalanceQuery(referrer: string | undefined) {
  return createQuery({
    ...memecookingKeys.account.storageBalance(referrer ?? ""),
    enabled: !!referrer,
  });
}

export function useMcStorageCostsQuery() {
  return createQuery(memecookingKeys.account.storageCosts());
}

export function useMcMemeDepositQuery(
  accountId: string,
  memeId: number,
): Readable<
  | {
      isLoading: false;
      isError: false;
      data: { meme_id: number; amount: FixedNumber };
    }
  | {
      isLoading: true;
      isError: false;
      data: undefined;
    }
  | {
      isLoading: false;
      isError: true;
      data: undefined;
    }
> {
  const baseAccountQuery = useMcBaseAccountQuery(accountId);

  return derived([baseAccountQuery], ([$baseAccount]) => {
    if (!$baseAccount.data)
      return {
        isLoading: true as const,
        isError: false as const,
        data: undefined,
      };

    const deposit = $baseAccount.data.deposits.find(
      (deposit) => deposit[0] === memeId,
    );
    if (!deposit)
      return {
        isLoading: false as const,
        isError: true as const,
        data: undefined,
      };

    return {
      isLoading: false as const,
      isError: false as const,
      data: {
        meme_id: deposit[0],
        amount: new FixedNumber(deposit[1], 24),
      },
    };
  });
}

export function useMcAccountQuery(
  accountId: string,
  blockHeight?: number,
): Readable<
  | {
      isLoading: false;
      isError: false;
      data: McAccount;
      refetch: () => Promise<void>;
    }
  | {
      isLoading: true;
      isError: false;
      data: undefined;
      refetch: () => Promise<void>;
    }
  | {
      isLoading: false;
      isError: true;
      data: undefined;
      refetch: () => Promise<void>;
    }
> {
  const baseAccountQuery = useMcBaseAccountQuery(accountId, blockHeight);
  const unclaimedQuery = useMcUnclaimedQuery(accountId, blockHeight);
  const profileQuery = useMcProfileQuery(accountId, blockHeight);
  const memesQuery = createQuery(memesQueryFactory.memes.all());

  return derived(
    [baseAccountQuery, unclaimedQuery, profileQuery, memesQuery],
    ([$baseAccount, $unclaimed, $profile, $memes]) => {
      const refetch = async () => {
        await Promise.all([
          $baseAccount.refetch(),
          $unclaimed.refetch(),
          $profile.refetch(),
          $memes.refetch(),
        ]);
      };

      if (
        $baseAccount.status === "pending" ||
        $unclaimed.status === "pending" ||
        $profile.status === "pending" ||
        $memes.status === "pending" ||
        $baseAccount.isFetching ||
        $unclaimed.isFetching ||
        $profile.isFetching ||
        $memes.isFetching
      ) {
        return {
          isLoading: true as const,
          isError: false as const,
          data: undefined,
          refetch,
        };
      }

      if (
        $baseAccount.status === "error" ||
        $unclaimed.status === "error" ||
        $profile.status === "error" ||
        $memes.status === "error"
      ) {
        return {
          isLoading: false as const,
          isError: true as const,
          data: undefined,
          refetch,
        };
      }

      const memeMap = new Map($memes.data.map((m: Meme) => [m.meme_id, m]));

      // Process deposits
      const deposits =
        $baseAccount.data?.deposits
          .map((deposit: [number, string]) => {
            const meme = memeMap.get(deposit[0]);
            if (!meme) return null;
            return {
              meme_id: deposit[0],
              amount: deposit[1].toString(),
              meme: {
                ...meme,
              },
            };
          })
          .filter(
            (deposit): deposit is NonNullable<typeof deposit> =>
              deposit != null,
          )
          .sort((a, b) => sortMemeByEndtimestamp(a.meme, b.meme)) ?? [];

      // Process unclaimed info
      const unclaimedInfo = $unclaimed.data.map(({ meme_id, amount }) => {
        const meme = memeMap.get(meme_id);
        if (!meme) return null;
        const token_id = getTokenId(meme);
        return {
          token_id,
          amount: new FixedNumber(amount ?? 0n, meme.decimals),
          meme,
        };
      });

      // Process claims
      const claims = Array.from(
        new Set([
          ...unclaimedInfo.map((info) => info?.meme.meme_id),
          ...$profile.data.deposited.map((m: { meme_id: number }) => m.meme_id),
        ]),
      )
        .map((meme_id) => {
          if (meme_id == null) return;
          const unclaimed = unclaimedInfo.find(
            (m) => m && m.meme.meme_id === meme_id,
          );
          if (unclaimed) {
            return {
              token_id: unclaimed.token_id,
              amount: unclaimed.amount,
              meme: unclaimed.meme,
            };
          }
          const meme = memeMap.get(meme_id);
          if (meme) {
            return {
              token_id: getTokenId(meme),
              amount: new FixedNumber(0n, meme.decimals),
              meme,
            };
          }
          return null;
        })
        .filter((claim): claim is NonNullable<typeof claim> => claim != null)
        .sort((a, b) =>
          sortMemeByUnclaimedThenEndTimestamp(
            {
              unclaimed: a.amount.valueOf() > 0n,
              end_timestamp_ms: a.meme.end_timestamp_ms ?? 0,
            },
            {
              unclaimed: b.amount.valueOf() > 0n,
              end_timestamp_ms: b.meme.end_timestamp_ms ?? 0,
            },
          ),
        );

      // Process revenue
      const revenue =
        $baseAccount.data?.income.map((income: [string, string]) => ({
          token_id: income[0],
          amount: income[1],
        })) ?? [];

      // Process created memes
      const created = $profile.data.created
        .map(({ meme_id }: { meme_id: number }) => {
          const meme = memeMap.get(meme_id);
          if (!meme) return;
          return {
            ...meme,
            projectedPoolStats: projectedPoolStats(meme),
          };
        })
        .filter((meme): meme is NonNullable<typeof meme> => meme != null);

      return {
        isLoading: false as const,
        isError: false as const,
        data: {
          deposits,
          claims,
          created,
          revenue,
          shitstarClaim: new FixedNumber(
            $baseAccount.data?.shitstar_claim ?? 0n,
            18,
          ),
          referralFees: new FixedNumber($profile.data.referral_fees, 24),
          withdrawFees: new FixedNumber($profile.data.withdraw_fees, 24),
        },
        refetch,
      };
    },
  );
}

export type McAccount = {
  deposits: {
    meme_id: number;
    amount: string;
    meme: Meme;
  }[];
  claims: {
    token_id: string;
    amount: FixedNumber;
    meme: Meme;
  }[];
  created: Meme[];
  revenue: {
    token_id: string;
    amount: string;
  }[];
  shitstarClaim: FixedNumber;
  referralFees: FixedNumber;
  withdrawFees: FixedNumber;
};
