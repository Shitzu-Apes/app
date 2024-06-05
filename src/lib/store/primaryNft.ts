import { FixedNumber } from "@tarnadas/fixed-number";
import { writable } from "svelte/store";

import { Nft, type Token } from "$lib/near";
import { Rewarder } from "$lib/near/rewarder";

export const primaryNftTokenId = writable<
  Promise<{
    token_id: string;
    score: FixedNumber;
    token: Token;
  } | null>
>(new Promise((resolve) => resolve(null)));

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
