import { derived, type Writable } from "svelte/store";

import { primaryNftTokenId } from ".";

import { Nft, Rewarder, type Token } from "$lib/near";
import { FixedNumber } from "$lib/util";

export const ranking = derived<
  Writable<
    Promise<{
      token_id: string;
      score: FixedNumber;
      token: Token;
    } | null>
  >,
  Promise<
    {
      token_id: string;
      account_id: string;
      score: FixedNumber;
    }[]
  >
>(primaryNftTokenId, ($primaryNftTokenId, set) => {
  $primaryNftTokenId;

  const ranking = $primaryNftTokenId.then(async (primaryNft) => {
    return await Rewarder.getLeaderboard(10).then(async (ranking) => {
      const nonStakedNfts: string[] = ranking
        .flatMap(([, account]) => {
          const nonStaked = account.filter(
            ([, accountId]) => accountId === null,
          );
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
      let isInRanking = false;
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

            if (token_id === primaryNft?.token_id) {
              account_id = "You";
              isInRanking = true;
            }

            return {
              token_id: account[0],
              account_id,
              score: new FixedNumber(score.toString(), 18),
            };
          }),
        )
        .slice(0, 10);

      if (!isInRanking && primaryNft) {
        result.push({
          token_id: primaryNft.token_id,
          account_id: "You",
          score: primaryNft.score,
        });
      }

      return result;
    });
  });

  set(ranking);
});

// export const ranking: Promise<
//   { token_id: string; account_id: string; score: FixedNumber }[]
// > = Rewarder.getLeaderboard(10).then(async (ranking) => {
//   const nonStakedNfts: string[] = ranking
//     .flatMap(([, account]) => {
//       const nonStaked = account.filter(([, accountId]) => accountId === null);
//       return nonStaked.map(([tokenId]) => tokenId);
//     })
//     .filter((tokenId) => tokenId !== null)
//     .flat() as string[];

//   const nonStakedTokens = await Promise.all(
//     nonStakedNfts.map(async (tokenId) => {
//       const owner = await Nft.nftToken(tokenId);
//       return [tokenId, owner.owner_id];
//     }),
//   ).then((tokens) => {
//     const tokenMap = tokens.reduce(
//       (acc, [tokenId, accountId]) => {
//         acc[tokenId] = accountId;
//         return acc;
//       },
//       {} as Record<string, string>,
//     );

//     return tokenMap;
//   });

//   // the ranking is already sorted
//   // we just need to flatten the array
//   let isInRanking = false;
//   const result = ranking
//     .flatMap(([score, accounts]) =>
//       accounts.map((account) => {
//         const token_id = account[0];
//         let account_id = account[1];

//         if (account_id === null) {
//           if (token_id in nonStakedTokens) {
//             account_id = nonStakedTokens[token_id];
//           } else {
//             account_id = "Anonymous";
//           }
//         }

//         if (token_id === primaryNft?.token_id) {
//           account_id = "You";
//           isInRanking = true;
//         }

//         return {
//           token_id: account[0],
//           account_id,
//           score: new FixedNumber(score.toString(), 18),
//         };
//       }),
//     )
//     .slice(0, 10);

//   if (!isInRanking && primaryNft) {
//     result.push({
//       token_id: primaryNft.token_id,
//       account_id: "You",
//       score: primaryNft.score,
//     });
//   }

//   return result;
// });
