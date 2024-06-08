import { type Writable, derived, writable } from "svelte/store";

import { Nft, type Token } from "$lib/near";
import { Rewarder } from "$lib/near/rewarder";
import { FixedNumber } from "$lib/util";

export type PrimaryNft = {
  token_id: string;
  score: FixedNumber;
  token: Token;
};

export const primaryNftTokenId = writable<Promise<PrimaryNft | null>>(
  new Promise((resolve) => resolve(null)),
);

export const resolvedPrimaryNftTokenId = derived<
  Writable<Promise<PrimaryNft | null>>,
  PrimaryNft | null
>(
  primaryNftTokenId,
  ($primaryNftTokenId, _set, update) => {
    $primaryNftTokenId.then((newPrimaryNft) => {
      if (newPrimaryNft) {
        update((currentPrimaryNft) => {
          if (
            currentPrimaryNft &&
            currentPrimaryNft.token_id === newPrimaryNft.token_id
          ) {
            return currentPrimaryNft;
          } else {
            return newPrimaryNft;
          }
        });
      }
    });
  },
  null,
);

export function refreshPrimaryNftOf(accountId: string) {
  primaryNftTokenId.set(
    Rewarder.primaryNftOf(accountId).then(async (somePrimaryNftTokenId) => {
      if (!somePrimaryNftTokenId) {
        return null;
      }

      const [token_id, score] = somePrimaryNftTokenId;
      const token = await Nft.nftToken(token_id);

      return { token_id, score: new FixedNumber(score, 18), token };
    }),
  );
}
