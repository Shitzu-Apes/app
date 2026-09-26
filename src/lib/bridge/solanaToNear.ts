import type { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import {
  ChainKind,
  getClient,
  omniAddress,
  type Transfer,
} from "omni-bridge-sdk";

import { CHAINS } from "./chains";
import { getOmniApi } from "./omni";
import { transfers as transfersStore } from "./transfers";

import {
  buildSwapTx,
  getQuote,
  WNEAR_MINT,
  type JupiterQuote,
} from "$lib/solana/jupiter";

export const NEAR = CHAINS.near;
export const SOLANA = CHAINS.solana;

export type BridgeLeg = "swap" | "bridge";

/** Structured outcome so the UI can show which leg it is on. */
export type BridgeProgress = {
  leg: BridgeLeg;
  message: string;
};

export class BridgeError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "BridgeError";
  }
}

/**
 * Quote SOL/USDC -> wNEAR on Solana. Returns null when Jupiter has no route,
 * which the UI renders as "no route available" rather than an error.
 */
export function quoteToWnear(
  amount: bigint,
  inputMint: string,
  slippageBps = 100,
): Promise<JupiterQuote | null> {
  return getQuote(inputMint, WNEAR_MINT, amount, slippageBps);
}

/** Sign and send the Jupiter swap, returning the transaction signature. */
export async function executeSwap(
  quote: JupiterQuote,
  provider: AnchorProvider,
): Promise<string> {
  try {
    const owner = provider.wallet.publicKey;
    const tx = await buildSwapTx(quote, owner);
    const signed = await provider.wallet.signTransaction(tx);
    return await provider.connection.sendRawTransaction(signed.serialize(), {
      preflightCommitment: "confirmed",
      maxRetries: 3,
    });
  } catch (err) {
    throw new BridgeError("The swap transaction failed", err);
  }
}

/** Omni Bridge fee for moving wNEAR from Solana to a NEAR account. */
export async function getWnearBridgeFee(sender: PublicKey, recipient: string) {
  const api = getOmniApi();
  return api.getFee(
    omniAddress(ChainKind.Sol, sender.toBase58()),
    omniAddress(ChainKind.Near, recipient),
    omniAddress(ChainKind.Sol, WNEAR_MINT),
  );
}

/** Deposit wNEAR into the Omni Bridge locker, returning the signature. */
export async function executeWnearBridge(
  amount: bigint,
  sender: PublicKey,
  recipient: string,
  provider: AnchorProvider,
): Promise<string> {
  const fee = await getWnearBridgeFee(sender, recipient);
  const client = getClient(ChainKind.Sol, provider);
  try {
    return await client.initTransfer({
      amount,
      fee: fee.transferred_token_fee ?? 0n,
      nativeFee: fee.native_token_fee ?? 0n,
      recipient: omniAddress(ChainKind.Near, recipient),
      tokenAddress: omniAddress(ChainKind.Sol, WNEAR_MINT),
    });
  } catch (err) {
    throw new BridgeError("The bridge transaction failed", err);
  }
}

const RECONCILE_ATTEMPTS = 20;
const RECONCILE_INTERVAL_MS = 3_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The Solana client returns a signature rather than an origin nonce, so poll the
 * API until the transfer is indexed. Mirrors the retry the bridge page uses.
 */
export async function reconcileTransfer(
  signature: string,
  onPoll?: (attempt: number, total: number) => void,
): Promise<Transfer> {
  const api = getOmniApi();

  for (let attempt = 1; attempt <= RECONCILE_ATTEMPTS; attempt++) {
    onPoll?.(attempt, RECONCILE_ATTEMPTS);
    await sleep(RECONCILE_INTERVAL_MS);
    try {
      const found = await api.findOmniTransfers({ transaction_id: signature });
      const id = found[0]?.id;
      if (id) {
        const transfer = (
          await api.getTransfer({
            originChain: id.origin_chain,
            originNonce: id.origin_nonce,
          })
        )[0];
        if (transfer) {
          transfersStore.addTransfers([transfer]);
          return transfer;
        }
      }
    } catch {
      // keep polling; the indexer can lag behind confirmation
    }
  }

  throw new BridgeError(
    "The transfer was submitted but could not be indexed yet. Check your history shortly.",
  );
}

export type SolToNearOptions = {
  amount: bigint;
  sourceMint: string;
  recipient: string;
  provider: AnchorProvider;
  slippageBps?: number;
  onProgress?: (progress: BridgeProgress) => void;
};

/**
 * Move `amount` of `sourceMint` from Solana into `recipient` on NEAR.
 *
 * When the source is not already wNEAR this runs two legs: a Jupiter swap into
 * wNEAR, then the Omni Bridge deposit. The bridged amount is the swap output
 * minus the bridge's token fee, so the user is not left with a dust remainder
 * stranded on Solana.
 */
export async function bridgeSolanaToNear({
  amount,
  sourceMint,
  recipient,
  provider,
  slippageBps = 100,
  onProgress,
}: SolToNearOptions): Promise<{ signature: string; bridged: bigint }> {
  const sender = provider.wallet.publicKey;
  let wnearAmount: bigint;

  if (sourceMint === WNEAR_MINT) {
    wnearAmount = amount;
  } else {
    onProgress?.({ leg: "swap", message: "Buying NEAR on Solana…" });

    const quote = await quoteToWnear(amount, sourceMint, slippageBps);
    if (!quote) {
      throw new BridgeError("No route to NEAR is available for that amount");
    }
    if (BigInt(quote.outAmount) <= 0n) {
      throw new BridgeError("That amount is too small to swap");
    }

    await executeSwap(quote, provider);
    // Use the provider's slippage floor: anything below it would have reverted.
    wnearAmount = BigInt(quote.otherAmountThreshold);
  }

  onProgress?.({ leg: "bridge", message: "Bridging NEAR to Near…" });

  const fee = await getWnearBridgeFee(sender, recipient);
  const tokenFee = fee.transferred_token_fee ?? 0n;
  if (wnearAmount <= tokenFee) {
    throw new BridgeError("That amount is too small to cover the bridge fee");
  }

  const bridgeSignature = await executeWnearBridge(
    wnearAmount,
    sender,
    recipient,
    provider,
  );

  return { signature: bridgeSignature, bridged: wnearAmount - tokenFee };
}
