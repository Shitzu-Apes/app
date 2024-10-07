import { derived, readable, type Readable } from "svelte/store";

import { getToken$, type TokenInfo } from "./tokens";

/**
 * {"symbol": "SHITZU", "contract_address": "token.0xshitzu.near", "price_list": [{"price": "0.000142614070", "date_time": 1716393600}, {"price": "0.000141895611", "date_time": 1716397200}, {"price": "0.000142819676", "date_time": 1716400800}, {"price": "0.000142979399", "date_time": 1716404400}, {"price": "0.000143682865", "date_time": 1716408000}, {"price": "0.000143022774", "date_time": 1716411600}, {"price": "0.000142639786", "date_time": 1716415200}, {"price": "0.000142636264", "date_time": 1716418800}, {"price": "0.000142815231", "date_time": 1716422400}, {"price": "0.000142635993", "date_time": 1716426000}, {"price": "0.000144291204", "date_time": 1716429600}, {"price": "0.000144291677", "date_time": 1716433200}, {"price": "0.000144313339", "date_time": 1716436800}, {"price": "0.000144246014", "date_time": 1716440400}, {"price": "0.000144200028", "date_time": 1716444000}, {"price": "0.000144022003", "date_time": 1716447600}, {"price": "0.000144378493", "date_time": 1716451200}, {"price": "0.000145458632", "date_time": 1716454800}, {"price": "0.000146555054", "date_time": 1716458400}, {"price": "0.000147109486", "date_time": 1716462000}, {"price": "0.000146739399", "date_time": 1716465600}, {"price": "0.000147109486", "date_time": 1716469200}, {"price": "0.000153497135", "date_time": 1716472800}, {"price": "0.000154718598", "date_time": 1716476400}, {"price": "0.000151700680", "date_time": 1716480000}]}
 */
export type ShitzuPriceHistory = {
  symbol: string;
  contract_address: string;
  price_list: {
    price: string;
    date_time: number;
  }[];
};

export const currentShitzuPrice = derived<
  Readable<Promise<TokenInfo>>,
  string | null
>(
  getToken$("token.0xshitzu.near"),
  ($token, set) => {
    $token.then((token) => {
      set(token.price ?? null);
    });
  },
  null,
);

export const shitzuPriceHistory = readable<ShitzuPriceHistory | null>(
  null,
  (set) => {
    fetch(
      "https://api.ref.finance/token-price-report?token=token.0xshitzu.near&base_token=17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1&dimension=D",
    )
      .then((res) => res.json())
      .then(
        (data: {
          symbol: string;
          contract_address: string;
          price_list: {
            price: string;
            date_time: number;
          }[];
        }) => {
          // Filter out the price history that is older than 25 hours
          const filteredPriceList = data.price_list.filter(
            (price) => price.date_time > Date.now() / 1000 - 25 * 60 * 60,
          );

          set(
            filteredPriceList.length > 0
              ? { ...data, price_list: filteredPriceList }
              : null,
          );
        },
      );
  },
);
