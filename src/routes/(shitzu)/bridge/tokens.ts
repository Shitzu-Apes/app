import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { readContract } from "@wagmi/core";
import {
  writable,
  get,
  type Writable,
  derived,
  type Readable,
} from "svelte/store";
import { match } from "ts-pattern";
import { erc20Abi } from "viem";

import {
  evmWallet$,
  wagmiConfig,
  baseConfig,
  arbitrumConfig,
  mainnetConfig,
} from "$lib/evm/wallet";
import type { Balance, EvmChain, Network } from "$lib/models/tokens";
import { Ft, nearBalance, nearWallet } from "$lib/near";
import { solanaWallet } from "$lib/solana/wallet";
import { FixedNumber } from "$lib/util";

export type TokenLinks = {
  buy?: {
    url: string;
    icon?: string;
    colors?: { bg: string; hover: string; text: string };
  };
  dexscreener?: { url: string; icon?: string };
  explorer?: { url: string; icon?: string };
};

export type Token = {
  symbol: string;
  icon: string;
  pool_id: number;
  decimals: Record<Network, number | undefined>;
  addresses: Record<Network, string | undefined>;
  links: Partial<Record<Network, TokenLinks>>;
};

const { account$ } = nearWallet;
const { publicKey$ } = solanaWallet;

export const TOKENS = {
  NEAR: {
    symbol: "NEAR",
    icon: "/wnear.webp",
    pool_id: 5471,
    decimals: {
      near: 24,
      solana: 9,
      base: 18,
      arbitrum: undefined,
      ethereum: undefined,
      bnb: undefined,
    },
    addresses: {
      near: "wrap.near",
      solana: "3ZLekZYq2qkZiSpnSvabjit34tUkjSwD1JFuW9as9wBG",
      base: undefined,
      arbitrum: undefined,
      ethereum: undefined,
      bnb: undefined,
    },
    links: {
      near: {
        buy: {
          url: "https://dex.rhea.finance/#|near",
          icon: "https://dex.rhea.finance/favicon.svg",
          colors: { bg: "black", hover: "rgb(24 24 27)", text: "white" },
        },
        dexscreener: {
          url: "https://dexscreener.com/near/refv1-5471",
          icon: "/icons/dexscreener.svg",
        },
        explorer: {
          url: "https://nearblocks.io/token/wrap.near",
          icon: "/icons/nearblocks.webp",
        },
      },
      solana: {
        buy: {
          url: "https://raydium.io/swap/?outputMint=3ZLekZYq2qkZiSpnSvabjit34tUkjSwD1JFuW9as9wBG",
          icon: "/icons/raydium.svg",
          colors: { bg: "#070a15", hover: "#0c1020", text: "white" },
        },
        dexscreener: {
          url: "https://dexscreener.com/solana/gyyigqg8vdemkdnttvl6at2msbhdtdwyb6bccyr238u",
          icon: "/icons/dexscreener.svg",
        },
        explorer: {
          url: "https://solscan.io/token/3ZLekZYq2qkZiSpnSvabjit34tUkjSwD1JFuW9as9wBG",
          icon: "/icons/solscan.webp",
        },
      },
    },
  },
  SHITZU: {
    symbol: "SHITZU",
    icon: "data:image/webp;base64,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",
    pool_id: 4369,
    decimals: {
      near: 18,
      solana: 9,
      base: 18,
      arbitrum: undefined,
      ethereum: undefined,
      bnb: undefined,
    },
    addresses: {
      near: "token.0xshitzu.near",
      solana: "AFbJW5rdaGidnF6o8ZqTtkDBpq3fotSBdJN8fGRN3VRS",
      base: undefined,
      // base: "0x473c1656373B3715805F647911e75AaA49C39813",
      arbitrum: undefined,
      ethereum: undefined,
      bnb: undefined,
    },
    links: {
      near: {
        buy: {
          url: "https://meme.cooking/meme/token.0xshitzu.near",
          icon: "https://raw.githubusercontent.com/Shitzu-Apes/brand-kit/bc9e35fda8a41fe263afbcc802d60d5ee23ad2ad/logo/meme-cooking.webp",
          colors: { bg: "#72E3B6", hover: "#5ED3A2", text: "black" },
        },
        dexscreener: {
          url: "https://dexscreener.com/near/refv1-4369",
          icon: "/icons/dexscreener.svg",
        },
        explorer: {
          url: "https://nearblocks.io/token/token.0xshitzu.near",
          icon: "/icons/nearblocks.webp",
        },
      },
      solana: {
        buy: {
          url: "https://www.orca.so/?tokenIn=So11111111111111111111111111111111111111112&tokenOut=AFbJW5rdaGidnF6o8ZqTtkDBpq3fotSBdJN8fGRN3VRS",
          icon: "/icons/orca.svg",
          colors: {
            bg: "#FFD15C",
            hover: "#fad985",
            text: "black",
          },
        },
        // dexscreener: {
        //   url: "https://dexscreener.com/TODO",
        //   icon: "/icons/dexscreener.svg",
        // },
        explorer: {
          url: "https://solscan.io/token/AFbJW5rdaGidnF6o8ZqTtkDBpq3fotSBdJN8fGRN3VRS",
          icon: "/icons/solscan.webp",
        },
      },
      // base: {
      //   buy: {
      //     url: "https://app.uniswap.org/#/swap?outputCurrency=0x473c1656373B3715805F647911e75AaA49C39813",
      //     icon: "/uniswap.webp",
      //     colors: {
      //       bg: "#0052FF",
      //       hover: "#0047DB",
      //       text: "white",
      //     },
      //   },
      //   dexscreener: {
      //     url: "https://dexscreener.com/base/0x473c1656373b3715805f647911e75aaa49c39813",
      //     icon: "/icons/dexscreener.svg",
      //   },
      //   explorer: {
      //     url: "https://basescan.org/token/0x473c1656373b3715805f647911e75aaa49c39813",
      //     icon: "/icons/etherscan.webp",
      //   },
      // },
    },
  },
  JAMBO: {
    symbol: "JAMBO",
    icon: "https://raw.githubusercontent.com/Shitzu-Apes/jambo/refs/heads/master/assets/jambo_self.webp",
    pool_id: 6518,
    decimals: {
      near: 18,
      solana: 9,
      base: undefined,
      arbitrum: undefined,
      ethereum: undefined,
      bnb: undefined,
    },
    addresses: {
      near: "jambo-1679.meme-cooking.near",
      solana: "2cMYUjUQJzrTcnxrD8JgL1BQL1AQKCtRkYLdmaTpCWYB",
      base: undefined,
      // base: "0x2427A35c66078996D8d8d9acf0d693D5fFec01e9",
      arbitrum: undefined,
      ethereum: undefined,
      bnb: undefined,
    },
    links: {
      near: {
        buy: {
          url: "https://meme.cooking/meme/1679",
          icon: "https://raw.githubusercontent.com/Shitzu-Apes/brand-kit/bc9e35fda8a41fe263afbcc802d60d5ee23ad2ad/logo/meme-cooking.webp",
          colors: { bg: "#72E3B6", hover: "#5ED3A2", text: "black" },
        },
        dexscreener: {
          url: "https://dexscreener.com/near/refv1-6518",
          icon: "/icons/dexscreener.svg",
        },
        explorer: {
          url: "https://nearblocks.io/token/jambo-1679.meme-cooking.near",
          icon: "/icons/nearblocks.webp",
        },
      },
      solana: {
        buy: {
          url: "https://www.orca.so/?tokenIn=So11111111111111111111111111111111111111112&tokenOut=2cMYUjUQJzrTcnxrD8JgL1BQL1AQKCtRkYLdmaTpCWYB",
          icon: "/icons/orca.svg",
          colors: {
            bg: "#FFD15C",
            hover: "#fad985",
            text: "black",
          },
        },
        // dexscreener: {
        //   url: "https://dexscreener.com/TODO",
        //   icon: "/icons/dexscreener.svg",
        // },
        explorer: {
          url: "https://solscan.io/token/2cMYUjUQJzrTcnxrD8JgL1BQL1AQKCtRkYLdmaTpCWYB",
          icon: "/icons/solscan.webp",
        },
      },
      // base: {
      //   buy: {
      //     url: "https://app.uniswap.org/#/swap?outputCurrency=0x2427A35c66078996D8d8d9acf0d693D5fFec01e9",
      //     icon: "/uniswap.webp",
      //     colors: {
      //       bg: "#0052FF",
      //       hover: "#0047DB",
      //       text: "white",
      //     },
      //   },
      //   dexscreener: {
      //     url: "https://dexscreener.com/base/0x2427a35c66078996d8d8d9acf0d693d5ffec01e9",
      //     icon: "/icons/dexscreener.svg",
      //   },
      //   explorer: {
      //     url: "https://basescan.org/token/0x2427a35c66078996d8d8d9acf0d693d5ffec01e9",
      //     icon: "/icons/etherscan.webp",
      //   },
      // },
    },
  },
  JLU: {
    symbol: "JLU",
    icon: "https://raw.githubusercontent.com/Shitzu-Apes/jlu/c9b2bdbd004aef8a02eea1894aa8ab77e9fb83ad/app/static/logo.webp",
    pool_id: 5728,
    decimals: {
      near: 18,
      solana: 9,
      base: 18,
      arbitrum: undefined,
      ethereum: undefined,
      bnb: undefined,
    },
    addresses: {
      near: "jlu-1018.meme-cooking.near",
      solana: "BAop4gZwr5JXGLLJXdt1jiLqzX7fxif7FTAEimntJMMS",
      base: undefined,
      // base: "0x2427A35c66078996D8d8d9acf0d693D5fFec01e9",
      arbitrum: undefined,
      ethereum: undefined,
      bnb: undefined,
    },
    links: {
      near: {
        buy: {
          url: "https://meme.cooking/meme/1018",
          icon: "https://raw.githubusercontent.com/Shitzu-Apes/brand-kit/bc9e35fda8a41fe263afbcc802d60d5ee23ad2ad/logo/meme-cooking.webp",
          colors: { bg: "#72E3B6", hover: "#5ED3A2", text: "black" },
        },
        dexscreener: {
          url: "https://dexscreener.com/near/refv1-5728",
          icon: "/icons/dexscreener.svg",
        },
        explorer: {
          url: "https://nearblocks.io/token/jlu-1018.meme-cooking.near",
          icon: "/icons/nearblocks.webp",
        },
      },
      solana: {
        buy: {
          url: "https://raydium.io/swap/?outputMint=BAop4gZwr5JXGLLJXdt1jiLqzX7fxif7FTAEimntJMMS",
          icon: "/icons/raydium.svg",
          colors: { bg: "#070a15", hover: "#0c1020", text: "white" },
        },
        dexscreener: {
          url: "https://dexscreener.com/solana/9upguecvwuml5x7346tvgizmubdjdjrzsk1msw28rd32",
          icon: "/icons/dexscreener.svg",
        },
        explorer: {
          url: "https://solscan.io/token/BAop4gZwr5JXGLLJXdt1jiLqzX7fxif7FTAEimntJMMS",
          icon: "/icons/solscan.webp",
        },
      },
      // base: {
      //   buy: {
      //     url: "https://app.uniswap.org/#/swap?outputCurrency=0x2427A35c66078996D8d8d9acf0d693D5fFec01e9",
      //     icon: "/uniswap.webp",
      //     colors: {
      //       bg: "#0052FF",
      //       hover: "#0047DB",
      //       text: "white",
      //     },
      //   },
      //   dexscreener: {
      //     url: "https://dexscreener.com/base/0x2427a35c66078996d8d8d9acf0d693d5ffec01e9",
      //     icon: "/icons/dexscreener.svg",
      //   },
      //   explorer: {
      //     url: "https://basescan.org/token/0x2427a35c66078996d8d8d9acf0d693d5ffec01e9",
      //     icon: "/icons/etherscan.webp",
      //   },
      // },
    },
  },
  PURGE: {
    symbol: "PURGE",
    icon: "data:image/png;base64,UklGRrIDAABXRUJQVlA4IKYDAAAwGACdASpgAGAAP7G6zmc8ryknvH94A5A2CWoAzkCCqaGFPaS9yv83xxkQvw+Konsv/3wkCUUQ1Oq2Qz9qOOkUY1hDSymYmVqiZagBtpTgBjSXnvmiIWVEkKtAewltk9gBFQ6x5KBAnSChG+08xYO4vyI2YizvPlNVV2Z5ypjEyb8YWAHmL/fHe4LBHR7y8u6lcrQ9v7tj92poQcgjyrtb8Ejwv0VtC51uD3geQjzhIi2RVOM2qzWb+DyZ6RPRrMkJKdLFKUDPMJNAAPJv5vhOy7BgcCIMMJ1XglA8W3PstAv/VFDmqQSf03x6lmEw7drRJkAkEZS1o1Zxi7vuxWme5dlaFsep8L93ni75ZuC1ac5zBIXVzqkwXj1Y5rAah85aVfbUVN0ZSqv5RroDzs1MpiZ33/eqXG+udld11eDn4vxkjCDziWOa0JwTTpXYpwRGIFwGCwka81dIvk1w8SM7BbS0ad83FcM32tBX9CfS1CIu3xkT8UFENC9BpdZiosh6aLBBNFZJRAEcFBF9cuV2vMxzzmDEDm8nzZ76nyZSVgD+r2CP6DwWqABDqUwX48V2tpjvD7BgGSwsCjKCTTzYdBuWTXOMwz53jD2M6kN6bUr4e6ICJgv4GygYwCTs4lWdn5LXyMaDEQiUGn2V3T/KTMlzGpd9sRQyguh6RuYArudcezBDrN8lbmTrFFe2eGR7qEdySQn/lJg5Z5gkphPICr1KkZSepuAeF21pT5jAcB6MS/0KU7N/ahGT3od/0TGzW+0GGpoVWmbaxupLdGFAHfHhvrLl8T3XyuxUkl8mkFv6JFvPVwomr4yv0GVgg7CcOxBHhJKMbRl7VqWORgeyfEzPpSiv87l6326/Txg/emIFICrtnOcXcr46GBT/jNdDgdlsMOHD6QiArvwtrUrcJTyv3gzyrO4MfSuwJTgeTYSDud8rH+Fyh2qDhKumJjVcI3kS5r1tTMi/9XF8y1uFGYLPkG/Ra/eYEGug5YFR+9hIlnHTmusGOyPdhCSnO4eXz3hDtGLTIpaqhaMmhopxRNdneBhSnPSIGgL1r4B1jG760bJqMCCcNNNNl6Hh6cuNQaoGnwlZ6vsXe26i89ALMz4TZk/R6MvVbGAP/6tdGIPdB7WQa8bBg3/CxmnfKnMGwjbk/iXNOSsmjGYkKWEmsY9RIrKaGTAibzrCnC32H3Y9HedSxq67ACnzFPVEbKP2O/2Z5p4S+ro6rLuHAdETfSIGcAAA",
    pool_id: 5650,
    decimals: {
      near: 18,
      solana: 9,
      base: 18,
      arbitrum: undefined,
      ethereum: undefined,
      bnb: undefined,
    },
    addresses: {
      near: "purge-558.meme-cooking.near",
      solana: "GqcYoMUr1x4N3kU7ViFd3T3EUx3C2cWKRdWFjYxSkKuh",
      base: undefined,
      arbitrum: undefined,
      ethereum: undefined,
      bnb: undefined,
    },
    links: {
      near: {
        buy: {
          url: "https://meme.cooking/meme/558",
          icon: "https://raw.githubusercontent.com/Shitzu-Apes/brand-kit/bc9e35fda8a41fe263afbcc802d60d5ee23ad2ad/logo/meme-cooking.webp",
          colors: { bg: "#72E3B6", hover: "#5ED3A2", text: "black" },
        },
        dexscreener: {
          url: "https://dexscreener.com/near/refv1-5650",
          icon: "/icons/dexscreener.svg",
        },
        explorer: {
          url: "https://nearblocks.io/token/purge-558.meme-cooking.near",
          icon: "/nearblocks.webp",
        },
      },
      solana: {
        // buy: {
        //   url: "https://raydium.io/swap/?outputMint=GqcYoMUr1x4N3kU7ViFd3T3EUx3C2cWKRdWFjYxSkKuh",
        //   icon: "/icons/raydium.svg",
        //   colors: {
        //     bg: "#070a15",
        //     hover: "#0c1020",
        //     text: "white",
        //   },
        // },
        // dexscreener: {
        //   url: "https://dexscreener.com/TODO",
        //   icon: "/icons/dexscreener.svg",
        // },
        explorer: {
          url: "https://solscan.io/token/GqcYoMUr1x4N3kU7ViFd3T3EUx3C2cWKRdWFjYxSkKuh",
          icon: "/icons/solscan.webp",
        },
      },
    },
  },
  POPPY: {
    symbol: "POPPY",
    icon: "data:image/png;base64,UklGRsIBAABXRUJQVlA4ILYBAACQEACdASpgAGAAP9He32i/tyyqrxWso/A6CWprT1munruBHK8u+8/fIKG0m1o1w/BsZyyOgLlvXaMAwowjJplr35mMUTkXgUF6qX2BJUkAJ4Gj1J34d89V5Ye83TDzqx3rZeLzPLx0O6DZL4TwxoTC0CCFb6hYvEwtPdSUgZEpXyEw+BwFUBF08y+mCAAA/uey2FccYHRrQqh8eiAjTppIkNC9X7/2xn0VjV5giDFahkLP2xVHBj7N09m5BsWT7C4cJ6y3KaGG7PitSuCWsFVqcdIxowtjVCj2ND6oj20BB81uQZXG2PSpL4qCzWCUUqeEJDF2CBZnUYEbhkRMA7kIUua/kQ5PzGq/tiIwFaII7kUUaPASlkJr5wpd6b45Iw1e9+Fhjtl2+yFXiqADbZFtQlWWuS7P9e+acQvK4FxwMJSR9ueqOpR1ckRdwCXsNwTP9zjOo4u7DolJBKl6NUdbO8RNXoTGUoaCX9F7kLSzWY/vZ9gKrT2iAjvsITFFd50bCg3FwpNBbTMA3qYM4zk+Qb+B8bFcIUXWz3/J45Imq9sT1QEdqy9y25APrzL6lMQzrLAZAAA=",
    pool_id: 5404,
    decimals: {
      near: 18,
      solana: 9,
      base: 18,
      arbitrum: undefined,
      ethereum: undefined,
      bnb: undefined,
    },
    addresses: {
      near: "poppy-0.meme-cooking-test.near",
      solana: "BdipjVpXcdamuEGkuvEkhebq8YortkswCVU2wuXncudb",
      base: undefined,
      arbitrum: undefined,
      ethereum: undefined,
      bnb: undefined,
    },
    links: {
      near: {
        buy: {
          url: "https://meme.cooking/meme/0",
          icon: "https://raw.githubusercontent.com/Shitzu-Apes/brand-kit/bc9e35fda8a41fe263afbcc802d60d5ee23ad2ad/logo/meme-cooking.webp",
          colors: { bg: "#72E3B6", hover: "#5ED3A2", text: "black" },
        },
        dexscreener: {
          url: "https://dexscreener.com/near/refv1-5404",
          icon: "/icons/dexscreener.svg",
        },
        explorer: {
          url: "https://nearblocks.io/token/poppy-0.meme-cooking-test.near",
          icon: "/icons/nearblocks.webp",
        },
      },
      solana: {
        // buy: {
        //   url: "https://raydium.io/swap/?outputMint=BdipjVpXcdamuEGkuvEkhebq8YortkswCVU2wuXncudb",
        //   icon: "/icons/raydium.svg",
        //   colors: {
        //     bg: "#070a15",
        //     hover: "#0c1020",
        //     text: "white",
        //   },
        // },
        // dexscreener: {
        //   url: "https://dexscreener.com/TODO",
        //   icon: "/icons/dexscreener.svg",
        // },
        explorer: {
          url: "https://solscan.io/token/BdipjVpXcdamuEGkuvEkhebq8YortkswCVU2wuXncudb",
          icon: "/icons/solscan.webp",
        },
      },
    },
  },
} as const satisfies Record<string, Token>;

export const TOKEN_ENTRIES = Object.entries(TOKENS) as [
  keyof typeof TOKENS,
  Token,
][];

export const balances$: Record<keyof typeof TOKENS, Writable<Balance>> = {
  NEAR: writable<Balance>({}),
  SHITZU: writable<Balance>({}),
  JAMBO: writable<Balance>({}),
  JLU: writable<Balance>({}),
  PURGE: writable<Balance>({}),
  POPPY: writable<Balance>({}),
};

async function fetchNearBalance(
  token: keyof typeof TOKENS,
  accountId: string,
): Promise<FixedNumber | undefined> {
  try {
    return Ft.balanceOf(
      TOKENS[token].addresses.near,
      accountId,
      TOKENS[token].decimals.near,
    ).then((balance) => {
      if (token === "NEAR") {
        const nearBal = get(nearBalance);
        if (nearBal) {
          return balance.add(nearBal);
        }
      }
      return balance;
    });
  } catch (err) {
    console.error(`Failed to fetch NEAR ${token} balance:`, err);
  }
}

async function fetchSolanaBalance(
  token: keyof typeof TOKENS,
  publicKey: PublicKey,
): Promise<FixedNumber | undefined> {
  try {
    const connection = solanaWallet.getConnection();
    const tokenMint = new PublicKey(
      TOKENS[token].addresses.solana as `0x${string}`,
    );
    const associatedTokenAddress = await getAssociatedTokenAddress(
      tokenMint,
      publicKey,
    );

    try {
      const account = await getAccount(connection, associatedTokenAddress);
      return new FixedNumber(account.amount, 9);
    } catch (err) {
      // Account doesn't exist yet (no tokens) or other error
      console.error(`Failed to fetch Solana ${token} balance:`, err);
    }
  } catch (err) {
    console.error(`Failed to fetch Solana ${token} balance:`, err);
  }
}

async function fetchEvmBalance(
  token: keyof typeof TOKENS,
  chain: EvmChain,
  address: string,
): Promise<FixedNumber | undefined> {
  try {
    const tokenAddress = TOKENS[token].addresses[chain] as
      | `0x${string}`
      | undefined;
    const decimals = TOKENS[token].decimals[chain];

    if (!tokenAddress || !decimals) {
      return undefined;
    }

    const chainConfig = match(chain)
      .with("base", () => baseConfig)
      .with("arbitrum", () => arbitrumConfig)
      .with("ethereum", () => mainnetConfig)
      .otherwise(() => wagmiConfig);
    const balance = await readContract(chainConfig, {
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    });

    return new FixedNumber(balance.toString(), decimals);
  } catch (err) {
    console.error(`Failed to fetch ${chain} balance:`, err);
  }
}

// Update NEAR balance whenever account changes
account$.subscribe(async (account) => {
  if (!account?.accountId) {
    for (const token of Object.keys(TOKENS) as (keyof typeof TOKENS)[]) {
      balances$[token].update((b) => ({ ...b, near: undefined }));
    }
    return;
  }

  for (const token of Object.keys(TOKENS) as (keyof typeof TOKENS)[]) {
    const balance = await fetchNearBalance(token, account.accountId);
    balances$[token].update((b) => ({ ...b, near: balance }));
  }
});

// Update Solana balance whenever wallet changes
publicKey$.subscribe(async (publicKey) => {
  if (!publicKey) {
    for (const token of Object.keys(TOKENS) as (keyof typeof TOKENS)[]) {
      balances$[token].update((b) => ({ ...b, solana: undefined }));
    }
    return;
  }

  for (const token of Object.keys(TOKENS) as (keyof typeof TOKENS)[]) {
    const balance = await fetchSolanaBalance(token, publicKey);
    balances$[token].update((b) => ({ ...b, solana: balance }));
  }
});

const updateTimeoutIds = new Map<
  keyof typeof TOKENS,
  ReturnType<typeof setTimeout>
>();

evmWallet$.subscribe(async (wallet) => {
  if (wallet.status !== "connected") {
    for (const token of Object.keys(TOKENS) as (keyof typeof TOKENS)[]) {
      balances$[token].update((b) => ({ ...b, base: undefined }));
    }
    return;
  }

  for (const token of Object.keys(TOKENS) as (keyof typeof TOKENS)[]) {
    updateTokenBalance(token);
  }
});

export function updateTokenBalance(token: keyof typeof TOKENS): void {
  const existingTimeout = updateTimeoutIds.get(token);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  const timeoutId = setTimeout(async () => {
    const account = get(account$);
    const publicKey = get(publicKey$);
    const wallet = get(evmWallet$);

    // Update NEAR balance if connected
    if (account?.accountId) {
      const nearBalance = await fetchNearBalance(token, account.accountId);
      balances$[token].update((b) => ({ ...b, near: nearBalance }));
    }

    // Update Solana balance if connected
    if (publicKey) {
      const solanaBalance = await fetchSolanaBalance(token, publicKey);
      balances$[token].update((b) => ({ ...b, solana: solanaBalance }));
    }

    // Update EVM balances if connected
    if (wallet.status === "connected") {
      updateEvmBalance(token, wallet.address);
    }

    // Clean up the timeout from the map once completed
    updateTimeoutIds.delete(token);
  }, 1000);

  // Store the new timeout
  updateTimeoutIds.set(token, timeoutId);
}

async function updateEvmBalance(
  token: keyof typeof TOKENS,
  address: string,
): Promise<void> {
  const baseBalance = await fetchEvmBalance(token, "base", address);
  const arbitrumBalance = await fetchEvmBalance(token, "arbitrum", address);
  const ethereumBalance = await fetchEvmBalance(token, "ethereum", address);
  balances$[token].update((b) => ({
    ...b,
    base: baseBalance,
    arbitrum: arbitrumBalance,
    ethereum: ethereumBalance,
  }));
}

export function findTokenByAddress(
  chainId: string,
  address: string,
): keyof typeof TOKENS | undefined {
  const normalizedChainId = chainId.toLowerCase();

  const chain = match(normalizedChainId)
    .with("sol", () => "solana" as const)
    .with("near", () => "near" as const)
    .with("base", () => "base" as const)
    .with("arb", () => "arbitrum" as const)
    .with("eth", () => "ethereum" as const)
    .otherwise(() => {
      console.warn(`Unknown chain ID: ${chainId}`);
      return undefined;
    });

  if (!chain) return undefined;

  if (address.includes(":")) {
    address = address.split(":")[1];
  }

  return Object.entries(TOKENS).find(
    ([_, token]) =>
      token.addresses[chain]?.toLowerCase() === address.toLowerCase(),
  )?.[0] as keyof typeof TOKENS | undefined;
}

export function getTokenBalance(
  network: Network,
  token: keyof typeof TOKENS,
): Readable<FixedNumber> {
  return derived(balances$[token], ($balance) => {
    const rawBalance = match(network)
      .with("near", () => $balance.near?.valueOf() ?? 0n)
      .with("solana", () => $balance.solana?.valueOf() ?? 0n)
      .with("base", () => $balance.base?.valueOf() ?? 0n)
      .with("arbitrum", () => $balance.arbitrum?.valueOf() ?? 0n)
      .with("ethereum", () => $balance.ethereum?.valueOf() ?? 0n)
      .with("bnb", () => $balance.bnb?.valueOf() ?? 0n)
      .exhaustive();

    return new FixedNumber(
      rawBalance.toString(),
      TOKENS[token].decimals[network] ?? 18,
    );
  });
}

export function isTokenAvailableOnNetwork(
  token: keyof typeof TOKENS,
  network: Network,
): boolean {
  return TOKENS[token].addresses[network] !== undefined;
}
