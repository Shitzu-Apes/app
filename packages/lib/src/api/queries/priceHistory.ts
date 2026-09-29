import { createQueryKeys } from "@lukemorales/query-key-factory";
import { createQuery } from "@tanstack/svelte-query";

export type ShitzuPriceHistory = {
  symbol: string;
  contract_address: string;
  price_list: {
    price: string;
    date_time: number;
  }[];
};

const queryKeys = createQueryKeys("priceHistory", {
  priceHistory: (tokenId: string) => ({
    queryKey: [tokenId],
    queryFn: () => getPriceHistory(tokenId),
  }),
});

export function usePriceHistoryQuery(tokenId: string) {
  return createQuery({
    ...queryKeys.priceHistory(tokenId),
    enabled: !!tokenId,
  });
}

async function getPriceHistory(tokenId: string) {
  const response = await fetch(
    `https://api.ref.finance/token-price-report?token=${tokenId}&base_token=17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1&dimension=D`,
  );
  const data = (await response.json()) as ShitzuPriceHistory;
  // Filter out the price history that is older than 25 hours
  const filteredPriceList = data.price_list.filter(
    (price) => price.date_time > Date.now() / 1000 - 25 * 60 * 60,
  );

  return filteredPriceList.length > 0
    ? { ...data, price_list: filteredPriceList }
    : null;
}
