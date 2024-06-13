import { writable } from "svelte/store";

import { Nft, Rewarder } from "$lib/near";
import { FixedNumber } from "$lib/util";

export const ranking = writable<
  Promise<
    {
      token_id: string;
      account_id: string;
      score: FixedNumber;
    }[]
  >
>(getLeaderboardWithNonStakedOwner(10));

async function getLeaderboardWithNonStakedOwner(limit: number = 10) {
  return Rewarder.getLeaderboard(limit).then(async (ranking) => {
    const nonStakedNfts: string[] = ranking
      .flatMap(([, account]) => {
        const nonStaked = account.filter(([, accountId]) => accountId === null);
        return nonStaked.map(([tokenId]) => tokenId);
      })
      .filter((tokenId) => tokenId !== null)
      .flat() as string[];

    const nonStakedTokens = await Promise.all(
      nonStakedNfts.map(async (tokenId) => {
        const owner = await Nft.nftToken(tokenId);
        return [tokenId, owner.owner_id];
      }),
    ).then((tokens) => {
      const tokenMap = tokens.reduce(
        (acc, [tokenId, accountId]) => {
          acc[tokenId] = accountId;
          return acc;
        },
        {} as Record<string, string>,
      );

      return tokenMap;
    });

    // the ranking is already sorted
    // we just need to flatten the array
    const result = ranking
      .flatMap(([score, accounts]) =>
        accounts.map((account) => {
          const token_id = account[0];
          let account_id = account[1];

          if (account_id === null) {
            if (token_id in nonStakedTokens) {
              account_id = nonStakedTokens[token_id];
            } else {
              account_id = "Anonymous";
            }
          }

          return {
            token_id: account[0],
            account_id,
            score: new FixedNumber(score.toString(), 18),
          };
        }),
      )
      .slice(0, limit);

    return result;
  });
}

export async function refreshRanking(limit: number = 10) {
  ranking.set(getLeaderboardWithNonStakedOwner(limit));
}
