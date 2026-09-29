import type { AnchorProvider } from "@coral-xyz/anchor";

import { executeSolanaSwap } from "./aggregators";
import { waitForTokenBalance } from "./executeSolana";
import { TransferError, type TransferProgress } from "./transfer";

import { getQuote } from "$lib/solana/jupiter";

/**
 * The Solana side of the destination leg.
 *
 * This runs as its own transaction *after* the bridge has finalised, and it has
 * to. Nothing on Solana can be pre-authorised against funds that do not exist
 * yet, so the user signs a second time once the first leg has landed. That is the
 * price of not routing their tokens through a relayer, and it is worth it: a
 * route that has died in the meantime leaves the user holding the rail token,
 * which is a strictly better outcome than anything a relayer could have done
 * with it.
 */

export type SolanaDestinationResult = {
  /** What the swap delivered, in the target mint's base units. */
  received: bigint;
  /** The floor it was signed at. */
  guaranteed: bigint;
  venues: string[];
};

/**
 * Swap the arrived rail into the token the user actually asked for.
 *
 * Re-quoted rather than reusing the search's numbers, because the bridge window
 * is long enough — tens of seconds at best — that the original quote is not the
 * one that will execute. A stale floor is a reverted transaction, and the user
 * has already waited for the bridge.
 */
export async function runSolanaDestinationSwap({
  railMint,
  targetMint,
  amountIn,
  provider,
  onProgress,
}: {
  /** The arrived rail's SPL mint. */
  railMint: string;
  /** The target's SPL mint. */
  targetMint: string;
  /** What arrived, in the rail's Solana base units. */
  amountIn: bigint;
  provider: AnchorProvider;
  onProgress?: (progress: TransferProgress) => void;
}): Promise<SolanaDestinationResult> {
  if (amountIn <= 0n) {
    throw new TransferError("Nothing arrived to convert");
  }

  onProgress?.({ leg: "convert", message: "Converting on Solana…" });

  const quote = await getQuote(railMint, targetMint, amountIn);
  if (!quote) {
    throw new TransferError(
      "The route into your target token is no longer available. Your tokens have arrived — swap them from the token list.",
    );
  }

  const guaranteed = BigInt(quote.otherAmountThreshold);
  if (guaranteed <= 0n) {
    throw new TransferError("That amount is too small to convert");
  }

  await executeSolanaSwap(quote, provider);
  await waitForTokenBalance(provider, targetMint, guaranteed).catch((err) => {
    // The swap is submitted and will settle on its own; failing to observe it in
    // time is not a reason to tell the user it did not work.
    console.error("[bridge] destination swap did not settle in time", err);
  });

  return {
    received: BigInt(quote.outAmount),
    guaranteed,
    venues: [...new Set(quote.routePlan.map((step) => step.swapInfo.label))],
  };
}
