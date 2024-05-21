import { readable } from "svelte/store";

export const tokenPrice$ = readable<{
  [token_address: string]: {
    price: string;
    decimals: number;
    symbol: string;
  };
}>({}, (set) => {
  const interval = setInterval(() => {
    fetchData();
  }, 10_000);

  fetchData();

  function fetchData() {
    fetch("https://api.ref.finance/list-token-price")
      .then((res) => res.json())
      .then((data) => {
        console.log("tokenPrice", data);
        set(data);
      });
  }
  return () => clearInterval(interval);
});
