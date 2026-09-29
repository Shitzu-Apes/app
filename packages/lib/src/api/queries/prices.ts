import { createQueryKeyStore } from "@lukemorales/query-key-factory";
import { createQuery } from "@tanstack/svelte-query";

import { FixedNumber } from "$lib/util/FixedNumber";
import { getNearPrice } from "$lib/util/projectedMCap";

export const priceQueryFactory = createQueryKeyStore({
  nearPrice: {
    all: null,
    detail: () => ({
      queryKey: ["nearPrice"],
      queryFn: async function () {
        const nearPriceBigInt = await getNearPrice();
        return new FixedNumber(nearPriceBigInt, 24);
      },
    }),
  },
});

export function createNearPriceQuery() {
  return createQuery({
    ...priceQueryFactory.nearPrice.detail(),
    staleTime: 1000 * 60 * 5, // 5 minutes, matching the cache expiry
  });
}
