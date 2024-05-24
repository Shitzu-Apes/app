import { readable } from "svelte/store";

import type { FungibleTokenMetadata } from "$lib/abi";

export type TokenInfo = {
  price: string;
  decimal: number;
  symbol: string;
};

export const tokenPrices$ = readable<{
  [token_address: string]: TokenInfo;
} | null>(null, (set) => {
  const interval = setInterval(() => {
    fetchData();
  }, 30_000);

  fetchData();

  function fetchData() {
    Promise.all([
      fetch("https://api.ref.finance/list-token-price")
        .then((res) => res.json())
        .then((data) => {
          return data as Record<string, TokenInfo>;
        }),
      refreshDexScreenerPrices(),
    ]).then(([refPrices, dexScreenerPrices]) => {
      set({ ...refPrices, ...dexScreenerPrices });
    });
  }
  return () => clearInterval(interval);
});

const poolIds: Record<string, string> = {
  "avb.tkn.near": "20",
  "intel.tkn.near": "4663",
};

async function refreshDexScreenerPrices(): Promise<{
  [token_address: string]: TokenInfo;
}> {
  const promises = Object.entries(poolIds).map(([token_address, poolId]) => {
    return Promise.all([
      token_address,
      fetchMetadata(token_address).catch(() => {
        throw new Error("Failed to fetch metadata");
      }),
      fetch(
        `https://api.dexscreener.com/latest/dex/pairs/near/refv1-${poolIds[token_address]}`,
      )
        .then((res) => res.json() as Promise<{ pairs: { priceUsd: string }[] }>)
        .catch(() => ({ pairs: [{ priceUsd: "0" }] })),
    ]);
  });

  const results = await Promise.all(promises);

  return results.reduce((acc, [token_address, metadata, { pairs }]) => {
    if (!metadata) return acc;
    const price = pairs[0].priceUsd;
    const tokenInfo: TokenInfo = {
      price,
      decimal: metadata.decimals,
      symbol: metadata.symbol,
    };
    return { ...acc, [token_address]: tokenInfo };
  }, {});
}

async function fetchMetadata(
  tokenId: string,
): Promise<FungibleTokenMetadata | undefined> {
  const res = await fetch(import.meta.env.VITE_NODE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "dontcare",
      method: "query",
      params: {
        request_type: "call_function",
        finality: "final",
        account_id: tokenId,
        method_name: "ft_metadata",
        args_base64: "",
      },
    }),
  });
  const json = await res.json();
  if (!json.result) return;
  const result = new Uint8Array(json.result.result);
  const decoder = new TextDecoder();
  const nep141Metadata = JSON.parse(
    decoder.decode(result),
  ) as FungibleTokenMetadata;
  return nep141Metadata;
}
