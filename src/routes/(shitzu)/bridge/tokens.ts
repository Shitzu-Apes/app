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
import { match, P } from "ts-pattern";
import { erc20Abi } from "viem";

import {
  evmWallet$,
  config,
  baseConfig,
  arbitrumConfig,
  mainnetConfig,
} from "$lib/evm/wallet";
import type { Balance, EvmChain, Network, Token } from "$lib/models/tokens";
import { Ft, nearWallet } from "$lib/near";
import { solanaWallet } from "$lib/solana/wallet";
import { FixedNumber } from "$lib/util";

const { account$ } = nearWallet;
const { publicKey$ } = solanaWallet;

export const TOKENS = {
  BURN: {
    symbol: "BURN",
    icon: "https://plum-necessary-chameleon-942.mypinata.cloud/ipfs/QmVA9RFwK7WEuEAxkVBBoe8Jn8n41fSj759znKB321CCpJ",
    decimals: {
      near: 18,
      solana: 9,
      base: 18,
      arbitrum: undefined,
      ethereum: undefined,
    },
    addresses: {
      near: "burn-1411.meme-cooking.near",
      solana: "DUTnBCHccnt6JMwdfjhsnDWC7bTpQZMQSVQkP24WxmAo",
      base: "0xadaeb24f2c12131ceedb85c6061bdabbd51f8232",
      arbitrum: undefined,
      ethereum: undefined,
    },
  },
  SOMES: {
    symbol: "SOMES",
    icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjUiIGhlaWdodD0iNjYiIHZpZXdCb3g9IjAgMCA2NSA2NiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTY0IDEwLjQzODVDNjQuNTUyMyAxMC40Mzg1IDY1IDEwLjg4NjIgNjUgMTEuNDM4NVY1NC45Mzg1QzY1IDU1LjQ5MDggNjQuNTUyMyA1NS45Mzg1IDY0IDU1LjkzODVINjAuMTI1VjU5LjgxMzVDNjAuMTI1IDYwLjM2NTggNTkuNjc3MyA2MC44MTM1IDU5LjEyNSA2MC44MTM1SDU1LjI1VjY0LjY4ODVDNTUuMjUgNjUuMjQwOCA1NC44MDIzIDY1LjY4ODUgNTQuMjUgNjUuNjg4NUgxMC43NUMxMC4xOTc3IDY1LjY4ODUgOS43NSA2NS4yNDA4IDkuNzUgNjQuNjg4NVY2MC44MTM1SDUuODc1QzUuMzIyNzIgNjAuODEzNSA0Ljg3NSA2MC4zNjU4IDQuODc1IDU5LjgxMzVWNTUuOTM4NUgxQzAuNDQ3NzE1IDU1LjkzODUgMCA1NS40OTA4IDAgNTQuOTM4NVYxMS40Mzg1QzAgMTAuODg2MiAwLjQ0NzcxNSAxMC40Mzg1IDEgMTAuNDM4NUg0Ljg3NVY2LjU2MzQ4QzQuODc1IDYuMDExMTkgNS4zMjI3MiA1LjU2MzQ4IDUuODc1IDUuNTYzNDhIOS43NVYxLjY4ODQ4QzkuNzUgMS4xMzYxOSAxMC4xOTc3IDAuNjg4NDc3IDEwLjc1IDAuNjg4NDc3SDU0LjI1QzU0LjgwMjMgMC42ODg0NzcgNTUuMjUgMS4xMzYxOSA1NS4yNSAxLjY4ODQ4VjUuNTYzNDhINTkuMTI1QzU5LjY3NzMgNS41NjM0OCA2MC4xMjUgNi4wMTExOSA2MC4xMjUgNi41NjM0OFYxMC40Mzg1SDY0WiIgZmlsbD0iIzA2MDYwNiIvPgo8ZyBjbGlwLXBhdGg9InVybCgjY2xpcDBfNjg2MF82NzA0KSI+CjxwYXRoIGQ9Ik00My41Mzg2IDE0SDE1VjIyLjAyODhIMzcuNzk5OUMzOS44MTYyIDIyLjAyODggNDEuNjU2MyAyMi44NTI0IDQxLjY1NjMgMjQuNjU2OFYyOS4zMjgxQzQxLjY1NjMgMzEuNjYzNyAzOS44MTYyIDMyLjI0NzIgMzcuNzk5OSAzMi4yNDcySDI0LjMwNjFMMzkuMDQwNyA1Mi42ODRINTAuOTgzNUw0MC4xMjY0IDM4LjA4NjNINDMuNTM4NkM0My41Mzg2IDM4LjA4NjMgNTAuOTgzNSAzOC42NzA3IDUwLjk4MzUgMzAuNDk1OVYyMS4xNTMzQzUwLjk4MzUgMTUuMzE0MiA0Ni43Nzk2IDE0IDQzLjUzODYgMTRaIiBmaWxsPSIjOUVGRjAwIi8+CjxwYXRoIGQ9Ik0xNSA1Mi42ODU0VjM2LjYyNzlMMjYuNjMyNiA1Mi42ODU0SDE1WiIgZmlsbD0iIzlFRkYwMCIvPgo8L2c+CjxkZWZzPgo8Y2xpcFBhdGggaWQ9ImNsaXAwXzY4NjBfNjcwNCI+CjxyZWN0IHdpZHRoPSIzNiIgaGVpZ2h0PSIzOC42NDcxIiBmaWxsPSJ3aGl0ZSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTUgMTQpIi8+CjwvY2xpcFBhdGg+CjwvZGVmcz4KPC9zdmc+Cg==",
    decimals: {
      near: 18,
      solana: 9,
      base: 18,
      arbitrum: undefined,
      ethereum: undefined,
    },
    addresses: {
      near: "somes.tkn.primitives.near",
      solana: "JDErYzAaEVbCHkD6K8SuESoCBtdoSCG17UFGyvtBKWYy",
      base: undefined,
      arbitrum: undefined,
      ethereum: undefined,
    },
  },
  // JLU: {
  //   symbol: "JLU",
  //   icon: "https://raw.githubusercontent.com/Shitzu-Apes/jlu/c9b2bdbd004aef8a02eea1894aa8ab77e9fb83ad/app/static/logo.webp",
  //   decimals: {
  //     near: 18,
  //     solana: 9,
  //     base: 18,
  //     arbitrum: undefined,
  //     ethereum: undefined,
  //   },
  //   addresses: {
  //     near: "jlu-1018.meme-cooking.near",
  //     solana: undefined,
  //     base: undefined,
  //     arbitrum: undefined,
  //     ethereum: undefined,
  //   },
  // },
} as const satisfies Record<string, Token>;

export const TOKEN_ENTRIES = Object.entries(TOKENS) as [
  keyof typeof TOKENS,
  Token,
][];

export const balances$: Record<keyof typeof TOKENS, Writable<Balance>> = {
  BURN: writable<Balance>({}),
  SOMES: writable<Balance>({}),
  // JLU: writable<Balance>({}),
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
    const baseBalance = await match(TOKENS[token].addresses.base)
      .with(P.string, () => {
        return fetchEvmBalance(token, "base", wallet.address);
      })
      .otherwise(() => {
        return undefined;
      });
    const arbitrumBalance = await match(TOKENS[token].addresses.arbitrum)
      .with(P.string, () => {
        return fetchEvmBalance(token, "arbitrum", wallet.address);
      })
      .otherwise(() => {
        return undefined;
      });
    const ethereumBalance = await match(TOKENS[token].addresses.ethereum)
      .with(P.string, () => {
        return fetchEvmBalance(token, "ethereum", wallet.address);
      })
      .otherwise(() => {
        return undefined;
      });
    balances$[token].update((b) => ({
      ...b,
      base: baseBalance,
      arbitrum: arbitrumBalance,
      ethereum: ethereumBalance,
    }));
  }
});

// Function to manually update balance
let updateTimeoutId: ReturnType<typeof setTimeout>;
export function updateTokenBalance(token: keyof typeof TOKENS): void {
  clearTimeout(updateTimeoutId);
  updateTimeoutId = setTimeout(async () => {
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
      const baseBalance = await fetchEvmBalance(token, "base", wallet.address);
      const arbitrumBalance = await fetchEvmBalance(
        token,
        "arbitrum",
        wallet.address,
      );
      const ethereumBalance = await fetchEvmBalance(
        token,
        "ethereum",
        wallet.address,
      );
      balances$[token].update((b) => ({
        ...b,
        base: baseBalance,
        arbitrum: arbitrumBalance,
        ethereum: ethereumBalance,
      }));
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
