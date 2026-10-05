import {
  getAssociatedTokenAddress,
  getAccount,
  TokenAccountNotFoundError,
} from "@solana/spl-token";
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

import { getChainByChainId } from "$lib/bridge/chains";
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
  pool_id?: number;
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
      near: import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID,
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
  OMGY: {
    symbol: "OMGY",
    icon: "data:image/png;base64,UklGRugCAABXRUJQVlA4INwCAACwEgCdASpgAGAAP7nG1mc9saunubsO27A3CWw+Dx/vMd/CVYQcWh/K9/ou3jMmMRKywIftWovDXru1rip0XEvUOgNwo3VU++JiOZ2Tb9lfErx21zjQjDvrU6YY72cvhd75Vszth4ja6NwABISx4pr27pMudUuDpGQT18RUjBEngNQ3yk/01daKVguQOgwaK95+lBnCJ5f+nxGJihg0AAD0x15EBecDJelA4XFmBv/FDmrDCN1+/nDdWQJZhS+4IsbdJksfhyXQAg8q769dLMs2G//Ajm+A2ewSftPqkIQDjk7zLpmMPKtZwa2rJXMA9eF5HnLYWFiqC7bbR8iGNysgti7hfAwJy2vnBzA9dGC8Xeu/hOYL+AYhMvgZslVEr2YO/cn/H0yNvRkKM5SXNrPCjkbkOfhwEV8Izot4w6JX34Md7pZ2mawO4CxUUagwBArDO5DK45/M2lZTr5w6c6f9SOB4A7pfawO+pz22s9BmrifSuLJCbf6rmWHLKo+R7u64F0Jgp118iDGyZby1LlWiRb0fHAI1dafoPYhsCvt/o+zS5vtTj5trrNi3zsb9NwZ0Vd4YSg7IV1AZbTryTs4aB/ZcInCAA+DT+7Q5cAj7BzXd08oBIJK00YwUDBKYy8ORPM6WaUvE9fAFFleq823SlLQ8g7796SAm5+76iGVQRQ//+tP1x9E4Ic0aBKywYMZ7Oy8XZqwsB2H/7imNnSSoje0+JI0ReDQ7AH96G/wXDpsmQsUXr64m9aTCST+6FDeSijTPW/Xg+wxCdcIhAcYzYo2xR8+qwSB+hsVxWNbCgxSPH00BDSrfmvA0vS4L5/CclSL3bsbEwMIlgvRwRmg0ygdWGRsszdU8nKYAYwRTidByMiwZXeFG1Cse2GiPw60jpwHR9Ek3f+5Grp14RVUCA6YHLScP09nTIn1yHg8GYfOznZiBAEeIgiqwibxDqtdU0GWnKgfSs9YAAAA=",
    pool_id: 8700,
    decimals: {
      near: 18,
      solana: 9,
      base: undefined,
      arbitrum: undefined,
      ethereum: undefined,
      bnb: undefined,
    },
    addresses: {
      near: "omgy-1992.meme-cooking.near",
      solana: "7krfuHcr3doqGj4iebDRDfJ29ugdNA4yjHBq7yL82wQa",
      base: undefined,
      arbitrum: undefined,
      ethereum: undefined,
      bnb: undefined,
    },
    links: {
      near: {
        buy: {
          url: "https://dex.intea.rs/terminal?from=near&to=omgy-1992.meme-cooking.near",
          icon: "/icons/intear.svg",
        },
        dexscreener: {
          url: "https://dexscreener.com/near/refv1-8700",
          icon: "/icons/dexscreener.svg",
        },
        explorer: {
          url: "https://nearblocks.io/token/omgy-1992.meme-cooking.near",
          icon: "/icons/nearblocks.webp",
        },
      },
      solana: {
        buy: {
          url: "https://jup.ag/swap/SOL-7krfuHcr3doqGj4iebDRDfJ29ugdNA4yjHBq7yL82wQa",
        },
        explorer: {
          url: "https://solscan.io/token/7krfuHcr3doqGj4iebDRDfJ29ugdNA4yjHBq7yL82wQa",
          icon: "/icons/solscan.webp",
        },
      },
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
      bnb: 18,
    },
    addresses: {
      near: "jambo-1679.meme-cooking.near",
      solana: "2cMYUjUQJzrTcnxrD8JgL1BQL1AQKCtRkYLdmaTpCWYB",
      base: undefined,
      // base: "0x2427A35c66078996D8d8d9acf0d693D5fFec01e9",
      arbitrum: undefined,
      ethereum: undefined,
      // bnb: "0x123219ea174eF80B37BD3459048aBEC86ADa618E",
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
      bnb: {
        buy: {
          url: "https://app.uniswap.org/#/swap?outputCurrency=0x123219ea174eF80B37BD3459048aBEC86ADa618E",
          icon: "/uniswap.webp",
        },
        explorer: {
          url: "https://bscscan.com/address/0x123219ea174eF80B37BD3459048aBEC86ADa618E",
          icon: "/icons/bscscan.webp",
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
          icon: "/icons/nearblocks.webp",
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
  XAUT: {
    symbol: "XAUt",
    icon: 'data:image/svg+xml,<svg width="165" height="165" viewBox="0 0 165 165" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M54.6366 84.7375C57.3593 87.7551 68.4638 90.0184 81.7556 90.0187C95.0473 90.0184 106.152 87.7551 108.868 84.7375C106.568 82.1761 98.2286 80.16 87.6395 79.6084V85.9928C85.7422 86.0879 83.7694 86.1387 81.7524 86.1387C79.7354 86.1387 77.7626 86.0943 75.8653 85.9928V79.6084C65.2825 80.16 56.9435 82.1761 54.6366 84.7375Z" fill="%23DFBF6A"/><path fill-rule="evenodd" clip-rule="evenodd" d="M117.391 48.0668L135.525 79.3865V79.3929C136.464 81.0159 136.187 83.0637 134.844 84.3825L84.924 133.397C83.3041 134.989 80.701 134.989 79.0874 133.397L29.2301 84.4459C27.8623 83.0954 27.6039 80.9906 28.6124 79.3548L47.9943 47.9654C48.7507 46.7481 50.0933 46 51.5367 46H113.792C115.28 46 116.647 46.7862 117.391 48.0668ZM87.6458 68.7733V74.8661H87.6395C100.094 75.5191 109.442 78.1946 109.511 81.4027V88.085C109.442 91.2931 100.094 93.9622 87.6395 94.6153V109.571H75.8653V94.6153C63.4105 93.9622 54.0693 91.2931 54 88.085V81.4027C54.0693 78.1946 63.4105 75.5191 75.8653 74.8661V68.7733H58.1348V59.9861H105.376V68.7733H87.6458Z" fill="%23DFBF6A"/></svg>',
    // pool_id: TODO,
    decimals: {
      near: 6,
      solana: undefined,
      base: undefined,
      arbitrum: undefined,
      ethereum: 6,
      bnb: undefined,
    },
    addresses: {
      near: "68749665ff8d2d112fa859aa293f07a622782f38.factory.bridge.near",
      solana: undefined,
      base: undefined,
      arbitrum: undefined,
      ethereum: "0x68749665FF8D2d112Fa859AA293F07A622782F38",
      bnb: undefined,
    },
    links: {
      near: {
        buy: {
          url: "https://dex.intea.rs/?from=near&to=nep141:68749665ff8d2d112fa859aa293f07a622782f38.factory.bridge.near",
          icon: "/icons/intear.svg",
        },
        // dexscreener: {
        //   url: "https://dexscreener.com/TODO",
        //   icon: "/icons/dexscreener.svg",
        // },
        explorer: {
          url: "https://nearblocks.io/token/68749665ff8d2d112fa859aa293f07a622782f38.factory.bridge.near",
          icon: "/icons/nearblocks.webp",
        },
      },
      ethereum: {
        buy: {
          url: "https://app.uniswap.org/swap?outputCurrency=0x68749665FF8D2d112Fa859AA293F07A622782F38&chain=ethereum",
          icon: "/icons/uniswap.svg",
        },
        dexscreener: {
          url: "https://dexscreener.com/ethereum/0x6546055f46e866a4b9a4a13e81273e3152bae5da",
          icon: "/icons/dexscreener.svg",
        },
        explorer: {
          url: "https://etherscan.io/token/0x68749665FF8D2d112Fa859AA293F07A622782F38",
          icon: "icons/etherscan.svg",
        },
      },
    },
  },

  CYPH: {
    symbol: "CYPH",
    icon: "data:image/png;base64,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",
    decimals: {
      near: 6,
      solana: 6,
      base: undefined,
      arbitrum: undefined,
      ethereum: undefined,
      bnb: undefined,
    },
    addresses: {
      near: "sol-0x2c51f8b0bacdce9517012c3e784d69d32d9d7ade.omdep.near",
      solana: "CYPHuMmCL1GxJWa2tsPhLKykC7GrHJTCHwbXD4g5uawK",
      base: undefined,
      arbitrum: undefined,
      ethereum: undefined,
      bnb: undefined,
    },
    links: {
      near: {
        explorer: {
          url: "https://nearblocks.io/token/sol-0x2c51f8b0bacdce9517012c3e784d69d32d9d7ade.omdep.near",
          icon: "/icons/nearblocks.webp",
        },
      },
      solana: {
        buy: {
          url: "https://backpack.exchange/trade/cyph.us",
          icon: "https://backpack.exchange/api/stock-logo/CYPH",
        },
        dexscreener: {
          url: "https://dexscreener.com/solana/c7esemj5yvs5njfsywii7d8hd11ftgcq7rgruus4h13u",
          icon: "/icons/dexscreener.svg",
        },
        explorer: {
          url: "https://solscan.io/token/CYPHuMmCL1GxJWa2tsPhLKykC7GrHJTCHwbXD4g5uawK",
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
  OMGY: writable<Balance>({}),
  JAMBO: writable<Balance>({}),
  JLU: writable<Balance>({}),
  PURGE: writable<Balance>({}),
  POPPY: writable<Balance>({}),
  XAUT: writable<Balance>({}),
  CYPH: writable<Balance>({}),
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
  const mint = TOKENS[token].addresses.solana;
  const decimals = TOKENS[token].decimals.solana;
  // A token with no Solana presence has no mint to derive an account from.
  if (!mint || decimals === undefined) return undefined;

  try {
    const connection = solanaWallet.getConnection();
    const associatedTokenAddress = await getAssociatedTokenAddress(
      new PublicKey(mint),
      publicKey,
    );

    try {
      const account = await getAccount(connection, associatedTokenAddress);
      return new FixedNumber(account.amount, decimals);
    } catch (err) {
      // No associated token account means the wallet holds none of this token,
      // which is the normal case for most rows rather than a failure. Logging
      // it produced one error per token per wallet, burying real problems.
      if (!(err instanceof TokenAccountNotFoundError)) {
        console.error(`Failed to fetch Solana ${token} balance:`, err);
      }
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

const updateTokenBalanceCache = new Map<keyof typeof TOKENS, number>();
const CACHE_DURATION_MS = 10_000;

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
  const now = Date.now();
  const lastUpdate = updateTokenBalanceCache.get(token);

  if (lastUpdate && now - lastUpdate < CACHE_DURATION_MS) {
    return;
  }

  updateTokenBalanceCache.set(token, now);

  const existingTimeout = updateTimeoutIds.get(token);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  const timeoutId = setTimeout(async () => {
    const account = get(account$);
    const publicKey = get(publicKey$);
    const wallet = get(evmWallet$);

    if (account?.accountId) {
      const nearBalance = await fetchNearBalance(token, account.accountId);
      balances$[token].update((b) => ({ ...b, near: nearBalance }));
    }

    if (publicKey) {
      const solanaBalance = await fetchSolanaBalance(token, publicKey);
      balances$[token].update((b) => ({ ...b, solana: solanaBalance }));
    }

    if (wallet.status === "connected") {
      updateEvmBalance(token, wallet.address);
    }

    updateTimeoutIds.delete(token);
  }, 1000);

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
  const chain = getChainByChainId(chainId);
  if (!chain) {
    console.warn(`Unknown chain ID: ${chainId}`);
    return undefined;
  }

  if (address.includes(":")) {
    address = address.split(":")[1];
  }

  return Object.entries(TOKENS).find(
    ([_, token]) =>
      token.addresses[chain.network]?.toLowerCase() === address.toLowerCase(),
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
