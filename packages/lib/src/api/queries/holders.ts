import { createQueryKeys } from "@lukemorales/query-key-factory";

import { MemeCooking } from "$lib/near/memecooking";
import { FixedNumber } from "$lib/util";

type HolderDisplay = [string, string];

async function fetchTokenHolders(
  tokenId: string,
  totalSupply: string,
): Promise<HolderDisplay[]> {
  const response = await fetch(
    `${import.meta.env.VITE_FASTNEAR_API}/v1/ft/${tokenId}/top`,
  );
  const data = await response.json();
  return data.accounts
    .map((holder: { account_id: string; balance: string }) => {
      const percentage = new FixedNumber(holder.balance, 24)
        .div(new FixedNumber(totalSupply, 24))
        .mul(new FixedNumber(100n, 0));
      return [
        holder.account_id,
        percentage.format({ maximumFractionDigits: 2 }),
      ];
    })
    .filter(([_account, percentage]: HolderDisplay) => percentage !== "0");
}

async function fetchMemeStakeHolders(
  memeId: string,
  totalSupply: string,
  teamAllocation: string,
  totalDeposit: string,
): Promise<HolderDisplay[] | null> {
  const startIndex = 0;
  const limit = 1000;
  const holders = await MemeCooking.getMemeStakes(
    Number(memeId),
    startIndex,
    limit,
  );
  if (!holders || holders.length === 0) return null;

  // Sort from highest to lowest
  holders.sort((a, b) => (BigInt(b[1]) > BigInt(a[1]) ? 1 : -1));

  const totalStaked = new FixedNumber(BigInt(totalDeposit ?? "0"), 24);
  const delta = 1 / 1.98;

  // Calculate team allocation percentage
  const teamAllocationPercentage =
    BigInt(teamAllocation ?? "0") > 0n && BigInt(totalSupply ?? "0") > 0n
      ? Number(
          (BigInt(teamAllocation ?? "0") / BigInt(totalSupply ?? "0")) * 100n,
        )
      : 0;

  // Calculate pool and depositor percentages
  const remainingPercentage = Number(
    (100 - teamAllocationPercentage).toFixed(2),
  );
  const poolPercentage = Number((remainingPercentage * delta).toFixed(2));
  const depositorPercentage = Number(
    (remainingPercentage * (1 - delta)).toFixed(2),
  );

  const holdersWithPercentage = holders.map(([holder, amount]) => {
    const percentage =
      totalStaked.valueOf() === 0n
        ? totalStaked
        : new FixedNumber(amount, 24)
            .div(totalStaked)
            .mul(
              new FixedNumber(BigInt(Math.round(depositorPercentage * 100)), 2),
            );

    return [
      holder,
      percentage.format({ maximumFractionDigits: 2 }),
    ] as HolderDisplay;
  });

  const result: HolderDisplay[] = [
    [
      "pool",
      new FixedNumber(BigInt(Math.round(poolPercentage * 100)), 2).format({
        maximumFractionDigits: 2,
      }),
    ],
  ];

  if (teamAllocationPercentage > 0) {
    result.push([
      "team",
      new FixedNumber(
        BigInt(Math.round(teamAllocationPercentage * 100)),
        2,
      ).format({ maximumFractionDigits: 2 }),
    ]);
  }

  return [...result, ...holdersWithPercentage];
}

export const holders = createQueryKeys("holders", {
  tokenHolders: (tokenId: string, totalSupply: string) => ({
    queryKey: [tokenId, totalSupply],
    queryFn: () => fetchTokenHolders(tokenId, totalSupply),
  }),
  memeStakeHolders: ({
    memeId,
    totalSupply,
    teamAllocation,
    totalDeposit,
  }: {
    memeId: string;
    totalSupply: string;
    teamAllocation: string;
    totalDeposit: string;
  }) => ({
    queryKey: [{ memeId, totalSupply, teamAllocation, totalDeposit }],
    queryFn: () =>
      fetchMemeStakeHolders(memeId, totalSupply, teamAllocation, totalDeposit),
  }),
});
