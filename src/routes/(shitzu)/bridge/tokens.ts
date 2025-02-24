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
  config,
  baseConfig,
  arbitrumConfig,
  mainnetConfig,
} from "$lib/evm/wallet";
import type { Balance, EvmChain, Network, Token } from "$lib/models/tokens";
import { Ft, nearBalance, nearWallet } from "$lib/near";
import { solanaWallet } from "$lib/solana/wallet";
import { FixedNumber } from "$lib/util";

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
    },
    addresses: {
      near: "wrap.near",
      solana: "3ZLekZYq2qkZiSpnSvabjit34tUkjSwD1JFuW9as9wBG",
      base: undefined,
      arbitrum: undefined,
      ethereum: undefined,
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
    },
    addresses: {
      near: "token.0xshitzu.near",
      solana: "AFbJW5rdaGidnF6o8ZqTtkDBpq3fotSBdJN8fGRN3VRS",
      base: "0x473c1656373B3715805F647911e75AaA49C39813",
      arbitrum: undefined,
      ethereum: undefined,
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
    },
    addresses: {
      near: "jlu-1018.meme-cooking.near",
      solana: "BAop4gZwr5JXGLLJXdt1jiLqzX7fxif7FTAEimntJMMS",
      base: "0x2427A35c66078996D8d8d9acf0d693D5fFec01e9",
      arbitrum: undefined,
      ethereum: undefined,
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
    },
    addresses: {
      near: "purge-558.meme-cooking.near",
      solana: "GqcYoMUr1x4N3kU7ViFd3T3EUx3C2cWKRdWFjYxSkKuh",
      base: undefined,
      arbitrum: undefined,
      ethereum: undefined,
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
    },
    addresses: {
      near: "poppy-0.meme-cooking-test.near",
      solana: "BdipjVpXcdamuEGkuvEkhebq8YortkswCVU2wuXncudb",
      base: undefined,
      arbitrum: undefined,
      ethereum: undefined,
    },
  },
  // BURN: {
  //   symbol: "BURN",
  //   icon: "data:image/png;base64,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",
  //   decimals: {
  //     near: 18,
  //     solana: 9,
  //     base: 18,
  //     arbitrum: 18,
  //     ethereum: undefined,
  //   },
  //   addresses: {
  //     near: "burn-1411.meme-cooking.near",
  //     solana: "DUTnBCHccnt6JMwdfjhsnDWC7bTpQZMQSVQkP24WxmAo",
  //     base: "0xadaeb24f2c12131ceedb85c6061bdabbd51f8232",
  //     arbitrum: "0xAdAEb24f2C12131cEeDb85C6061BDabBd51f8232",
  //     ethereum: undefined,
  //   },
  // },
} as const satisfies Record<string, Token>;

export const TOKEN_ENTRIES = Object.entries(TOKENS) as [
  keyof typeof TOKENS,
  Token,
][];

export const balances$: Record<keyof typeof TOKENS, Writable<Balance>> = {
  NEAR: writable<Balance>({}),
  SHITZU: writable<Balance>({}),
  JLU: writable<Balance>({}),
  PURGE: writable<Balance>({}),
  POPPY: writable<Balance>({}),
  // BURN: writable<Balance>({}),
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
      .otherwise(() => config);
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

// Update Base balance whenever wallet changes
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

// Function to manually update balance
const updateTimeoutIds = new Map<
  keyof typeof TOKENS,
  ReturnType<typeof setTimeout>
>();
export function updateTokenBalance(token: keyof typeof TOKENS): void {
  // Clear existing timeout for this specific token if it exists
  const existingTimeout = updateTimeoutIds.get(token);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  // Set new timeout for this token
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

// Add this helper function to find token by address
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

// Add this helper function to get balance for a specific network and token
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
      .exhaustive();

    return new FixedNumber(
      rawBalance.toString(),
      TOKENS[token].decimals[network] ?? 18,
    );
  });
}

// Add this helper function to check if a token is available on a network
export function isTokenAvailableOnNetwork(
  token: keyof typeof TOKENS,
  network: Network,
): boolean {
  return TOKENS[token].addresses[network] !== undefined;
}
