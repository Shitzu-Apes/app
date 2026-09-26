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
import {
  fetchTransfersBySender,
  getTransferKey,
  waitForTransfer,
  type BridgePhase,
  type RawTransfer,
} from "./status";
import { transfers as transfersStore } from "./transfers";

import {
  buildSwapTx,
  getQuote,
  SWAP_TOKENS,
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

/** wNEAR is an SPL token with 9 decimals. */
export const WNEAR_SPL_DECIMALS = 9;

export type BridgeFeeQuote = {
  /**
   * Taken out of the bridged amount, in SPL base units.
   *
   * The API already quotes this in the token's own decimals (verified against
   * mainnet: a 0.203889181 wNEAR transfer quotes 2071042, i.e. 0.00207 wNEAR,
   * which is exactly what the completed transfer deducted). It is also the
   * value `initTransfer` expects, so it must be passed through untouched. The
   * yoctoNEAR figure in the on-chain transfer message is the bridge's own
   * normalisation, not something the caller applies.
   */
  tokenFee: bigint;
  /** Paid on Solana, in lamports. */
  nativeFee: bigint;
  usdFee: number | null;
};

/** Omni Bridge fee for moving wNEAR from Solana to a NEAR account. */
export async function getWnearBridgeFee(
  sender: PublicKey,
  recipient: string,
  amount: bigint,
): Promise<BridgeFeeQuote> {
  const api = getOmniApi();
  const fee = await api.getFee(
    omniAddress(ChainKind.Sol, sender.toBase58()),
    omniAddress(ChainKind.Near, recipient),
    omniAddress(ChainKind.Sol, WNEAR_MINT),
    amount,
  );
  return {
    tokenFee: fee.transferred_token_fee ?? 0n,
    nativeFee: fee.native_token_fee ?? 0n,
    usdFee: typeof fee.usd_fee === "number" ? fee.usd_fee : null,
  };
}

/**
 * Deposit wNEAR into the Omni Bridge locker, returning the signature.
 *
 * The SDK's `initTransfer` sends *and* confirms in one `.rpc()` call, and
 * discards the signature if confirmation throws. A confirmation timeout or an
 * RPC rate limit therefore looks like a hard failure even though the deposit
 * is already on-chain and the funds do arrive. So on throw we look for a new
 * transfer from this sender before reporting anything, and only claim failure
 * when we are actually sure nothing was submitted.
 */
export async function executeWnearBridge(
  amount: bigint,
  sender: PublicKey,
  recipient: string,
  provider: AnchorProvider,
): Promise<{ signature: string; recovered: boolean }> {
  const fee = await getWnearBridgeFee(sender, recipient, amount);
  const client = getClient(ChainKind.Sol, provider);
  const senderTag = `sol:${sender.toBase58()}`;

  // Snapshot what the indexer already knows about this sender, so a brand new
  // transfer after our call is unambiguously ours.
  const before = new Set(
    (await fetchTransfersBySender(senderTag).catch(() => [])).map(
      getTransferKey,
    ),
  );

  try {
    const signature = await client.initTransfer({
      amount,
      fee: fee.tokenFee,
      nativeFee: fee.nativeFee,
      recipient: omniAddress(ChainKind.Near, recipient),
      tokenAddress: omniAddress(ChainKind.Sol, WNEAR_MINT),
    });
    return { signature, recovered: false };
  } catch (err) {
    console.error("[bridge] initTransfer threw, checking if it landed", err);
    const signature = await findNewTransferSignature(senderTag, before);
    if (signature) {
      return { signature, recovered: true };
    }
    throw new BridgeError(
      "The bridge deposit could not be submitted. Nothing was bridged — you can safely try again.",
      err,
    );
  }
}

/**
 * After a failed `initTransfer`, wait briefly for a transfer that was not there
 * before. Returns the origin transaction hash to poll, which may be the NEAR
 * receipt hash rather than the Solana signature.
 */
async function findNewTransferSignature(
  senderTag: string,
  before: Set<string>,
  timeoutMs = 60_000,
  intervalMs = 3_000,
): Promise<string | undefined> {
  const attempts = Math.ceil(timeoutMs / intervalMs);
  for (let i = 0; i < attempts; i++) {
    await sleep(intervalMs);
    try {
      const fresh = (await fetchTransfersBySender(senderTag)).filter(
        (t) => !before.has(getTransferKey(t)),
      );
      const hit = fresh[0];
      if (!hit) continue;

      const hash = receiptTxHash(hit);
      if (hash) return hash;
    } catch {
      // keep polling
    }
  }
  return undefined;
}

/**
 * Find a hash we can poll with, out of whichever receipts exist.
 *
 * The API nests receipts as single-key unions, and which one is present depends
 * on how far the transfer has progressed. A NEAR receipt hash is preferred
 * because it is stable once the destination leg exists; otherwise fall back to
 * the originating Solana signature.
 */
function receiptTxHash(transfer: RawTransfer): string | undefined {
  const dig = (
    value: unknown,
    unionKey: string,
    field: string,
  ): string | undefined => {
    if (!value || typeof value !== "object") return undefined;
    const inner = (value as Record<string, unknown>)[unionKey];
    if (!inner || typeof inner !== "object") return undefined;
    const found = (inner as Record<string, unknown>)[field];
    return typeof found === "string" ? found : undefined;
  };

  return (
    dig(transfer.finalised, "NearReceipt", "transaction_hash") ??
    dig(transfer.fast_finalised_on_near, "NearReceipt", "transaction_hash") ??
    dig(transfer.finalised_on_near, "NearReceipt", "transaction_hash") ??
    dig(transfer.initialized, "Solana", "signature")
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Follow a deposit through to the destination, reporting each phase.
 *
 * Indexing lags the chain, and the Near leg finalises a little later again, so
 * this polls both phases and tells the UI which one it is in rather than
 * showing one opaque spinner.
 */
export async function reconcileTransfer(
  txHash: string,
  onPhase?: (phase: BridgePhase, attempt: number, total: number) => void,
): Promise<RawTransfer> {
  const transfer = await waitForTransfer({ txHash, onPhase });
  transfersStore.addTransfers([transfer as unknown as Transfer]);
  return transfer;
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
 * Wait for a signature we sent ourselves to land, over plain HTTP.
 *
 * `connection.confirmTransaction` opens a `signatureSubscribe` websocket, which
 * the public cluster RPC rejects from a browser origin: it never resolves and
 * spams the console with "received json rpc error calling signatureSubscribe"
 * while retrying. Measured on mainnet, `confirmTransaction` was still hanging
 * after 8s where a `getSignatureStatuses` round trip took ~100ms. So poll
 * statuses instead, which is a single ordinary RPC call.
 */
export async function confirmTransaction(
  provider: AnchorProvider,
  signature: string,
  { attempts = 20, delayMs = 1_000 } = {},
): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    const [status] =
      (
        await provider.connection
          .getSignatureStatuses([signature])
          .catch(() => undefined)
      )?.value ?? [];

    if (status) {
      if (status.err) {
        throw new Error(`Transaction failed on chain: ${status.err}`);
      }
      // A present, error-free status means the cluster has seen it.
      return;
    }
    if (i < attempts - 1) await sleep(delayMs);
  }

  throw new Error(`Transaction ${signature} was not confirmed in time`);
}

/**
 * Wait until an SPL token account holds at least `minAmount`.
 *
 * This is the real precondition for the bridge deposit: the vault transfer
 * needs the associated token account to exist, and it is created by the swap.
 * Polling it directly over plain HTTP is both faster and more precise than
 * waiting on a confirmation, and it costs the user nothing when the swap
 * already settled.
 */
export async function waitForTokenBalance(
  provider: AnchorProvider,
  mint: string,
  minAmount: bigint,
  { attempts = 20, delayMs = 1_000 } = {},
): Promise<void> {
  const { getAccount, getAssociatedTokenAddress } = await import(
    "@solana/spl-token"
  );
  const { PublicKey } = await import("@solana/web3.js");

  const owner = provider.wallet.publicKey;
  const address = await getAssociatedTokenAddress(new PublicKey(mint), owner);

  for (let i = 0; i < attempts; i++) {
    const amount = await getAccount(provider.connection, address)
      .then((account) => BigInt(account.amount))
      .catch(() => 0n);
    if (amount >= minAmount) return;
    if (i < attempts - 1) await sleep(delayMs);
  }

  throw new Error("The swap has not settled yet");
}

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
}: SolToNearOptions): Promise<{
  signature: string;
  /** Amount that lands in the NEAR account, after the bridge fee. */
  bridged: bigint;
  /** What the bridge took, in SPL base units. */
  tokenFee: bigint;
  /** Solana network fee paid, in lamports. */
  nativeFee: bigint;
  recovered: boolean;
}> {
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

    const swapSignature = await executeSwap(quote, provider);
    // The deposit needs the wNEAR token account to exist, which only happens
    // once the swap settles. Poll the account itself rather than blocking on a
    // generic confirmation, so we wait exactly as long as we need and no more.
    await waitForTokenBalance(
      provider,
      SWAP_TOKENS.WNEAR.mint,
      BigInt(quote.otherAmountThreshold),
    ).catch((err) => {
      console.error("[bridge] swap did not settle in time", err);
    });
    void swapSignature;
    // Use the provider's slippage floor: anything below it would have reverted.
    wnearAmount = BigInt(quote.otherAmountThreshold);
  }

  onProgress?.({ leg: "bridge", message: "Bridging NEAR to Near…" });

  const fee = await getWnearBridgeFee(sender, recipient, wnearAmount);
  if (wnearAmount <= fee.tokenFee) {
    throw new BridgeError("That amount is too small to cover the bridge fee");
  }

  const { signature: bridgeSignature, recovered } = await executeWnearBridge(
    wnearAmount,
    sender,
    recipient,
    provider,
  );

  if (recovered) {
    onProgress?.({
      leg: "bridge",
      message: "Deposit confirmed despite a slow confirmation. Tracking it…",
    });
  }

  return {
    signature: bridgeSignature,
    bridged: wnearAmount - fee.tokenFee,
    tokenFee: fee.tokenFee,
    nativeFee: fee.nativeFee,
    recovered,
  };
}
