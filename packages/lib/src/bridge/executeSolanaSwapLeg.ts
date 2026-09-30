import type { AnchorProvider } from "@coral-xyz/anchor";

import { executeSolanaSwap } from "./aggregators";
import { waitForTokenBalance } from "./executeSolana";
import { TransferError, type TransferProgress } from "./transfer";

import { getQuote, type JupiterQuote } from "$lib/solana/jupiter";

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Attempts the destination quote gets before the swap is declared dead.
 *
 * A single empty answer is not a verdict on the market. Jupiter answers "no
 * route" for a pair it routes moments later — a thin pool, an indexer catching
 * up, a request that lands in a cold window — and the call that lands the
 * instant a bridge finalises is exactly the one that pays for it. So this leg
 * asks again, with waits that grow, and the same budget the NEAR execution side
 * uses: there is one leg, a user watching, and money already on the bridge.
 */
export const DESTINATION_QUOTE_ATTEMPTS = 5;
export const DESTINATION_QUOTE_BACKOFF_MS = [500, 1_000, 1_500, 2_000];

/** A test seam, so a test does not pay the app's real backoff to count calls. */
export type DestinationQuoteRouting = {
  attempts?: number;
  backoffMs?: number[];
};

/**
 * Quote the destination swap, asking more than once.
 *
 * Null still means "no route", but only after every attempt has come back empty.
 * A thrown error is retried on the same schedule and, if it outlives them all,
 * rethrown as itself: a network failure is not a market verdict, and dressing
 * one up as "no route" would be a claim the API never made.
 */
export async function quoteDestinationSwap(
  railMint: string,
  targetMint: string,
  amountIn: bigint,
  routing: DestinationQuoteRouting = {},
): Promise<JupiterQuote | null> {
  const attempts = routing.attempts ?? DESTINATION_QUOTE_ATTEMPTS;
  const backoffMs = routing.backoffMs ?? DESTINATION_QUOTE_BACKOFF_MS;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      await sleep(
        backoffMs[attempt - 1] ?? backoffMs[backoffMs.length - 1] ?? 0,
      );
    }
    try {
      const quote = await getQuote(railMint, targetMint, amountIn);
      if (quote) return quote;
    } catch (err) {
      lastError = err;
    }
  }

  if (lastError) throw lastError;
  return null;
}

/**
 * Swap the arrived rail into the token the user actually asked for.
 *
 * Re-quoted rather than reusing the search's numbers, because the bridge window
 * is long enough — tens of seconds at best — that the original quote is not the
 * one that will execute. A stale floor is a reverted transaction, and the user
 * has already waited for the bridge. The quote is also asked for more than once
 * — see `quoteDestinationSwap` — because an empty answer on the first ask is a
 * cold router far more often than it is a market with no route.
 */
export async function runSolanaDestinationSwap({
  railMint,
  targetMint,
  amountIn,
  provider,
  onProgress,
  routing,
}: {
  /** The arrived rail's SPL mint. */
  railMint: string;
  /** The target's SPL mint. */
  targetMint: string;
  /** What arrived, in the rail's Solana base units. */
  amountIn: bigint;
  provider: AnchorProvider;
  onProgress?: (progress: TransferProgress) => void;
  routing?: DestinationQuoteRouting;
}): Promise<SolanaDestinationResult> {
  if (amountIn <= 0n) {
    throw new TransferError("Nothing arrived to convert");
  }

  onProgress?.({ leg: "convert", message: "Converting on Solana…" });

  const quote = await quoteDestinationSwap(
    railMint,
    targetMint,
    amountIn,
    routing,
  );
  if (!quote) {
    throw new TransferError(
      "No swap route is available for your target token right now.",
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
