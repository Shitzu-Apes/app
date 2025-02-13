import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { readContract } from "@wagmi/core";
import { writable, get, type Writable } from "svelte/store";
import { match } from "ts-pattern";
import { erc20Abi } from "viem";

import { evmWallet$, config } from "$lib/evm/wallet";
import type { Balance, EvmChain, Network, Token } from "$lib/models/tokens";
import { Ft, nearWallet } from "$lib/near";
import { solanaWallet } from "$lib/solana/wallet";
import { FixedNumber } from "$lib/util";

const { account$ } = nearWallet;
const { publicKey$ } = solanaWallet;

export const TOKENS = {
  JLU: {
    symbol: "JLU",
    icon: "https://raw.githubusercontent.com/Shitzu-Apes/jlu/c9b2bdbd004aef8a02eea1894aa8ab77e9fb83ad/app/static/logo.webp",
    decimals: {
      near: 18,
      solana: 9,
      base: 18,
      arbitrum: undefined,
      ethereum: undefined,
    },
    addresses: {
      near: import.meta.env.VITE_JLU_TOKEN_ID,
      solana: import.meta.env.VITE_JLU_TOKEN_ID_SOLANA,
      base: import.meta.env.VITE_JLU_TOKEN_ID_BASE as `0x${string}`,
      arbitrum: undefined,
      ethereum: undefined,
    },
  },
} as const satisfies Record<string, Token>;

export const TOKEN_ENTRIES = Object.entries(TOKENS) as [
  keyof typeof TOKENS,
  Token,
][];

export const balances$: Record<keyof typeof TOKENS, Writable<Balance>> = {
  JLU: writable<Balance>({}),
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
    );
  } catch (err) {
    console.error("Failed to fetch NEAR JLU balance:", err);
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
      console.error("Failed to fetch Solana JLU balance:", err);
    }
  } catch (err) {
    console.error("Failed to fetch Solana JLU balance:", err);
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
      console.warn(`Token ${token} not supported on ${chain}`);
      return undefined;
    }

    const balance = await readContract(config, {
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
    const balance = await fetchNearBalance(
      TOKENS[token].addresses.near,
      account.accountId,
    );
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
    const balance = await fetchSolanaBalance(
      TOKENS[token].addresses.solana,
      publicKey,
    );
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
    const baseBalance = await fetchEvmBalance(token, "base", wallet.address);
    const arbitrumBalance = await fetchEvmBalance(
      token,
      "arbitrum",
      wallet.address,
    );
    balances$[token].update((b) => ({
      ...b,
      base: baseBalance,
      arbitrum: arbitrumBalance,
    }));
  }
});

// Function to manually update balance
let updateTimeoutId: ReturnType<typeof setTimeout>;
export function updateTokenBalance(
  token: keyof typeof TOKENS,
  diff?: FixedNumber,
): void {
  clearTimeout(updateTimeoutId);
  updateTimeoutId = setTimeout(async () => {
    const account = get(account$);
    const publicKey = get(publicKey$);
    const wallet = get(evmWallet$);

    // Update NEAR balance if connected
    if (account?.accountId) {
      if (diff) {
        balances$[token].update((balance) => ({
          ...balance,
          near: balance.near ? balance.near.add(diff) : diff,
        }));
      } else {
        const nearBalance = await fetchNearBalance(token, account.accountId);
        balances$[token].update((b) => ({ ...b, near: nearBalance }));
      }
    }

    // Update Solana balance if connected
    if (publicKey) {
      if (diff) {
        balances$[token].update((balance) => ({
          ...balance,
          solana: balance.solana ? balance.solana.add(diff) : diff,
        }));
      } else {
        const solanaBalance = await fetchSolanaBalance(
          TOKENS[token].addresses.solana,
          publicKey,
        );
        balances$[token].update((b) => ({ ...b, solana: solanaBalance }));
      }
    }

    // Update Base balance if connected
    if (wallet.status === "connected") {
      if (diff) {
        balances$[token].update((balance) => ({
          ...balance,
          base: balance.base ? balance.base.add(diff) : diff,
        }));
      } else {
        const baseBalance = await fetchEvmBalance(
          token,
          "base",
          wallet.address,
        );
        const arbitrumBalance = await fetchEvmBalance(
          token,
          "arbitrum",
          wallet.address,
        );
        balances$[token].update((b) => ({
          ...b,
          base: baseBalance,
          arbitrum: arbitrumBalance,
        }));
      }
    }
  }, 1000);
}

export { balances$ as jluBalance$ };

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

  return Object.entries(TOKENS).find(
    ([_, token]) =>
      token.addresses[chain]?.toLowerCase() === address.toLowerCase(),
  )?.[0] as keyof typeof TOKENS | undefined;
}

// Add this helper function to get balance for a specific network and token
export function getTokenBalance(
  network: Network,
  token: keyof typeof TOKENS,
): bigint {
  const balance = get(balances$[token]);
  return match(network)
    .with("near", () => balance.near?.valueOf() ?? 0n)
    .with("solana", () => (balance.solana?.valueOf() ?? 0n) * 1000000000n)
    .with("base", () => balance.base?.valueOf() ?? 0n)
    .with("arbitrum", () => balance.arbitrum?.valueOf() ?? 0n)
    .with("ethereum", () => balance.ethereum?.valueOf() ?? 0n)
    .exhaustive();
}
