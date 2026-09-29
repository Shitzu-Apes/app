import type { AnchorProvider } from "@coral-xyz/anchor";
import {
  ChainKind,
  getClient,
  omniAddress,
  type Transfer,
} from "omni-bridge-sdk";

import { executeSolanaSwap } from "./aggregators";
import { CHAIN_KIND } from "./fee";
import type { RoutePlan } from "./search";
import {
  fetchTransfersBySender,
  getTransferKey,
  type RawTransfer,
} from "./status";
import {
  prepareDeposit,
  railOf,
  TransferError,
  type TransferProgress,
} from "./transfer";
import { transfers as transfersStore } from "./transfers";

import type { Network } from "$lib/models/tokens";
import { getQuote } from "$lib/solana/jupiter";

/**
 * Everything that needs a Solana wallet.
 *
 * Two flows live here because they share the awkward parts — waiting for an SPL
 * token account to exist, and surviving a confirmation that times out after the
 * transaction has already landed. Writing them separately meant copying both.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Wait for an SPL token account to hold at least `minAmount`.
 *
 * This, not a generic confirmation, is the real precondition for the deposit: the
 * vault transfer needs the associated token account to exist, and a swap is what
 * creates it. Polling the account directly over plain HTTP is both faster and
 * more precise, and costs the user nothing when the swap already settled.
 *
 * `connection.confirmTransaction` is unusable here in any case: it opens a
 * `signatureSubscribe` websocket, which the public cluster RPC rejects from a
 * browser origin, so it never resolves and spams the console while retrying.
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

  throw new TransferError("The swap has not settled yet");
}

/**
 * Deposit a bridged token from Solana.
 *
 * The SDK's `initTransfer` sends *and* confirms in one call and discards the
 * signature if confirmation throws, so a timeout or an RPC rate limit looks like
 * a hard failure even though the deposit is on-chain and the funds do arrive. So
 * on throw we look for a transfer from this sender that was not there before,
 * and only claim failure when we are sure nothing was submitted.
 */
export async function depositFromSolana({
  plan,
  amount,
  fee,
  to,
  recipient,
  provider,
}: {
  plan: RoutePlan;
  amount: bigint;
  fee: { tokenFee: bigint; nativeFee: bigint };
  /** Which chain the recipient address belongs to. */
  to: Network;
  /** Address on `to`. */
  recipient: string;
  provider: AnchorProvider;
}): Promise<{ signature: string; recovered: boolean }> {
  const sender = provider.wallet.publicKey;
  const client = getClient(ChainKind.Sol, provider);
  const senderTag = `sol:${sender.toBase58()}`;

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
      recipient: omniAddress(CHAIN_KIND[to], recipient),
      tokenAddress: omniAddress(ChainKind.Sol, railOf(plan).sourceAddress),
    });
    return { signature, recovered: false };
  } catch (err) {
    // A warning, because this recovers: the SDK throws on a submission it may still
    // have made, so the chain is asked directly. Logging it as an error alarmed anyone
    // reading the console during a transfer that then went through perfectly.
    console.warn("[bridge] initTransfer threw, checking if it landed", err);
    const signature = await findNewTransferSignature(senderTag, before);
    if (signature) return { signature, recovered: true };
    throw new TransferError(
      "The bridge deposit could not be submitted. Nothing was bridged — you can safely try again.",
      err,
    );
  }
}

/** Poll for a transfer that was not there before, and return a hash to watch. */
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
      const hash = receiptTxHash(fresh[0]);
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
 * The API nests receipts as single-key unions and which one is present depends
 * on how far the transfer has got. A NEAR receipt hash is preferred because it
 * is stable once the destination leg exists; otherwise the originating Solana
 * signature.
 */
function receiptTxHash(transfer: RawTransfer | undefined): string | undefined {
  if (!transfer) return undefined;
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

export type SolanaSourceResult = {
  /** The deposit's transaction hash, for polling. */
  signature: string;
  recovered: boolean;
  /** What was handed to the bridge, in the rail's Solana base units. */
  bridged: bigint;
  tokenFee: bigint;
  nativeFee: bigint;
  /** What lands on the destination before any final swap. */
  arrived: bigint;
};

/**
 * Run the Solana side of a route: swap into the rail if needed, then deposit.
 *
 * The swap is re-quoted here rather than reusing the search's numbers. A quote
 * the user has been looking at for thirty seconds is not executable, and Jupiter
 * rejects a stale one anyway — so the amount deposited is the fresh floor, and
 * the fee is quoted on *that* in the same breath. Quoting the fee any earlier
 * would understate it, and the deposit would then be rejected after the user had
 * already signed for the swap.
 */
export async function runFromSolana({
  plan,
  amount,
  sourceMint,
  to,
  recipient,
  provider,
  onProgress,
}: {
  plan: RoutePlan;
  /** What the user asked to send, in the source mint's base units. */
  amount: bigint;
  sourceMint: string;
  /** Which chain the recipient address belongs to. */
  to: Network;
  /** Address on `to`. */
  recipient: string;
  provider: AnchorProvider;
  onProgress?: (progress: TransferProgress) => void;
}): Promise<SolanaSourceResult> {
  let bridged = amount;

  if (plan.sourceSwap) {
    onProgress?.({
      leg: "swap",
      message: `Swapping into ${railOf(plan).symbol}…`,
    });

    const quote = await getQuote(
      sourceMint,
      railOf(plan).sourceAddress,
      amount,
    );
    if (!quote) {
      throw new TransferError(
        "No route to the bridge is available for that amount right now",
      );
    }
    if (BigInt(quote.otherAmountThreshold) <= 0n) {
      throw new TransferError("That amount is too small to swap");
    }

    await executeSolanaSwap(quote, provider);
    // The deposit needs the rail's token account, which only exists once the
    // swap settles. Poll the account itself rather than blocking on a generic
    // confirmation, so we wait exactly as long as we need and no more.
    await waitForTokenBalance(
      provider,
      railOf(plan).sourceAddress,
      BigInt(quote.otherAmountThreshold),
    ).catch((err) => {
      console.error("[bridge] swap did not settle in time", err);
    });

    // The provider's own floor, not the estimate: anything above it would have
    // reverted, and anything below it is not what the quote promised.
    bridged = BigInt(quote.otherAmountThreshold);
  }

  onProgress?.({ leg: "bridge", message: `Bridging ${railOf(plan).symbol}…` });

  const sender = provider.wallet.publicKey.toBase58();
  const prepared = await prepareDeposit(plan, {
    from: "solana",
    to,
    sender,
    recipient,
    amount: bridged,
  });

  const { signature, recovered } = await depositFromSolana({
    plan,
    amount: prepared.amount,
    fee: prepared.fee,
    to,
    recipient,
    provider,
  });

  return {
    signature,
    recovered,
    bridged: prepared.amount,
    tokenFee: prepared.fee.tokenFee,
    nativeFee: prepared.fee.nativeFee,
    arrived: prepared.arrivedAmount,
  };
}

/** Record a transfer we just made, so the history list shows it immediately. */
export function trackTransfer(transfer: RawTransfer): void {
  transfersStore.addTransfers([transfer as unknown as Transfer]);
}
