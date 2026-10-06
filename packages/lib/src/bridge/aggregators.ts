import type { AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

import type { Rail } from "./rail";
import type { SwapLeg } from "./search";

import type { Network } from "$lib/models/tokens";
import {
  executableRoutes,
  getIntearRoutesRouted,
  normalizeTokenId,
  routeAmounts,
  selectBestRoute,
  type IntearRoute,
  type IntearRoutedOptions,
} from "$lib/near/intear";
import {
  buildSwapTx,
  describeRoute,
  getQuote,
  type JupiterQuote,
} from "$lib/solana/jupiter";

/**
 * The two aggregators, behind one interface.
 *
 * The route search does not know or care which chain it is pricing; it just
 * needs "swap this on that chain" to answer with a floor and an estimate. Both
 * implementations return null for a pair with no route, which is a normal answer
 * rather than a failure, and the search treats it as one rail being out.
 */

/** Solana uses SPL mints, which the aggregator already speaks. */
const SOLANA_CHAIN: Network = "solana";

function fromJupiter(quote: JupiterQuote): SwapLeg {
  return {
    // Jupiter's own floor. This is what will actually arrive, so it is what the
    // route search has to rank on.
    guaranteedOut: BigInt(quote.otherAmountThreshold),
    estimatedOut: BigInt(quote.outAmount),
    dexes: [...new Set(quote.routePlan.map((step) => step.swapInfo.label))],
    outputToken: quote.outputMint,
  };
}

export type SwapQuoter = {
  /** Floor, estimate, and the DEXes behind the route. Null when there is none. */
  (
    fromAddress: string,
    toAddress: string,
    amountIn: bigint,
    /**
     * The search's own cancellation, forwarded to the aggregator. Naming it on
     * the quoter rather than on the call site is what lets a superseded search
     * release its queued router calls — see `withRouterSlot` in `intear.ts` —
     * instead of spending them on a result nobody will read. An execution leg
     * quotes outside a search and has no signal, which is deliberate: a signed
     * transfer keeps waiting.
     */
    signal?: AbortSignal,
  ): Promise<SwapLeg | null>;
  /** A one-line description of the route, for the UI. */
  describe(leg: SwapLeg): string;
};

/**
 * A Jupiter quote, or null.
 *
 * The amount is not checked for a route here beyond what Jupiter itself
 * enforces: an amount too small for the pool comes back as no route, and an
 * amount too large for the user's balance fails later at signing, which is the
 * only place that failure is meaningful.
 */
export const quoteOnSolana: SwapQuoter = async (
  fromAddress,
  toAddress,
  amountIn,
) => {
  if (amountIn <= 0n) return null;
  const quote = await getQuote(fromAddress, toAddress, amountIn);
  return quote ? fromJupiter(quote) : null;
};

quoteOnSolana.describe = (leg) => {
  // The dex labels are the route: `Denali -> 1DEX -> Meteora DLMM`.
  return leg.dexes.join(" → ");
};

/**
 * An Intear route, or null.
 *
 * `traderAccountId` is not optional even though the API marks it so. Without it
 * the router cannot know what the signer is registered for and leaves out the
 * `near_deposit` and `storage_deposit` actions its own routes depend on, so the
 * transaction would be signed and then fail for want of a deposit.
 *
 * NEAR Intents routes are dropped: they need an NEP-413 signature and a solver
 * relay, which is a different flow, and Intear's own documentation describes
 * them as having poor liquidity and long wait times.
 */
/**
 * Pairs that have been observed to route at least once this session.
 *
 * The Intear router intermittently answers an empty list for a pair that routes
 * moments later — measured at roughly one call in three on a cold route, while
 * twenty identical calls in parallel all succeed. So an empty result means two
 * very different things: "this pool does not exist" and "the router was cold".
 *
 * Every empty answer is now retried once, so this set no longer decides who gets
 * a second chance. It is kept for one reason: a pair that has already routed and
 * now answers empty is a *regression* worth noticing, since that is how a pool
 * going dry looks rather than a cold router.
 */
const hasRouted = new Set<string>();

const pairKey = (chain: string, from: string, to: string) =>
  `${chain}:${from}->${to}`;

/** Test seam, and the reason a stale success cannot outlive a reload. */
export function clearRoutedPairs(): void {
  hasRouted.clear();
}

/**
 * Attempts a *search* makes before believing an empty answer.
 *
 * One, and this is a measured decision rather than a conservative one. Retrying a
 * single rail immediately does not work: thirty identical requests fired back to
 * back produced a run of *six* consecutive empties, so a second attempt lands
 * inside the same cold window as the first and fails with it. The fix for a cold
 * router is to ask at a different moment, and the search does that at a higher
 * level — the form re-runs the whole search once after a real wait when every rail
 * came back empty. So this stays at one: the search's own retry is the retry, and a
 * per-rail budget here would only multiply the request count on a debounce.
 *
 * A leg with a signature behind it gets the full budget instead, which it can
 * afford: there is one leg, a user waiting, and money already on the bridge.
 */
const SEARCH_ATTEMPTS = 1;

/**
 * Rate-limited asks a *search* may make, per leg.
 *
 * Ten, the same as the execution's budget and for the same reason. This used to
 * be lower — four — because a search fires several rails at once and each re-ask
 * landed on a bucket the others were still draining. Every router call now runs
 * through the queue in `intear.ts` and honours the shared 429 cooldown, so a
 * re-ask waits instead of adding to the burst, and a rail is given the same
 * chance to survive a limit as an execution leg with money behind it.
 */
const SEARCH_RATE_LIMIT_ATTEMPTS = 10;

export function intearQuoter(
  traderAccountId: string,
  /**
   * How hard to try the router, and how long to wait between attempts.
   *
   * A seam for tests, which otherwise pay several seconds of real backoff to count
   * calls. The defaults are the ones the app runs with.
   */
  routing: IntearRoutedOptions = {},
): SwapQuoter {
  const request = async (
    fromAddress: string,
    toAddress: string,
    amountIn: bigint,
    signal?: AbortSignal,
    routing: IntearRoutedOptions = {},
  ): Promise<IntearRoute[]> =>
    executableRoutes(
      await getIntearRoutesRouted(
        {
          tokenIn: fromAddress,
          tokenOut: toAddress,
          amountIn,
          traderAccountId,
          // Thin pools need room. At 1% the same pair that routes at 3% returns
          // nothing, which would make a live market look dead.
          slippage: 0.03,
          signal,
        },
        routing,
      ),
    );

  const quote = async (
    fromAddress: string,
    toAddress: string,
    amountIn: bigint,
    signal?: AbortSignal,
  ): Promise<SwapLeg | null> => {
    if (amountIn <= 0n) return null;

    // The retry lives in `getIntearRoutesRouted`, shared with the two execution
    // legs. It used to live here alone, which is precisely the problem: the search
    // was persistent about a cold router and the execution was not, so a route
    // could be put on screen by a retried quote and then fail on a single
    // un-retried call at the moment the user's money was already on the bridge.
    //
    // One attempt, and the asymmetry with execution is deliberate. Persistence is
    // proportional to what is at stake: a search is speculative and scores seven
    // rails at once, so it can afford to lose one to a cold router and still find a
    // route — and the form re-runs the whole search when *every* rail is lost, which
    // is the case that actually reaches the user. An execution has a signature behind
    // it, a user waiting, and money on the bridge, so it gets the full budget here.
    // Seven rails times two legs times three attempts is forty requests on a 400ms
    // debounce, which is a great deal of public API to spend on a keystroke.
    //
    // All of that is about *empty* answers, which are ambiguous. A rate limit is
    // not ambiguous and is not waited out by the form's schedule, so it gets a
    // budget of its own — see `SEARCH_RATE_LIMIT_ATTEMPTS`.
    const routes = await request(fromAddress, toAddress, amountIn, signal, {
      // Defaults, not overrides: a caller asking for more still gets it. The
      // spread matters because leaving `backoffMs` out silently replaced a test's
      // schedule with the app's, and the search's rate-limit budget needs to be
      // settable for exactly the same reason.
      ...routing,
      attempts: routing.attempts ?? SEARCH_ATTEMPTS,
      rateLimitAttempts:
        routing.rateLimitAttempts ?? SEARCH_RATE_LIMIT_ATTEMPTS,
    });
    if (routes.length === 0) return null;
    hasRouted.add(pairKey("near", fromAddress, toAddress));

    const best = selectBestRoute(routes);
    if (!best) return null;
    const { estimatedOut, worstCaseOut } = routeAmounts(best);
    return {
      guaranteedOut: worstCaseOut,
      estimatedOut,
      dexes: [best.dex_id],
      // The router is asymmetric about the `nep141:` prefix: it rejects that form
      // on the way in, answering an empty route list, but hands it back on the
      // way out. Left un-normalised it would never compare equal to the address
      // the search asked about, so any equality check on the output token would
      // silently fail.
      outputToken: normalizeTokenId(best.token_output),
    };
  };

  quote.describe = (leg: SwapLeg) => leg.dexes.join(" → ");
  return quote;
}

/** The quoter for whichever chain a leg happens to be on. */
export function quoterFor(
  chain: Network,
  options: { traderAccountId?: string } = {},
): SwapQuoter {
  if (chain === "near") {
    if (!options.traderAccountId) {
      throw new Error("A NEAR quote needs the account that will sign it");
    }
    return intearQuoter(options.traderAccountId);
  }
  if (chain === SOLANA_CHAIN) return quoteOnSolana;
  throw new Error(`No aggregator is wired up for ${chain}`);
}

/**
 * Sign and send a Jupiter swap, returning its signature.
 *
 * Deliberately does not wait for confirmation. The deposit that follows needs
 * the rail's token account to exist, and that only happens once the swap
 * settles, so the caller polls the balance itself rather than blocking on a
 * generic confirmation that would be either too early or too late.
 */
export async function executeSolanaSwap(
  quote: JupiterQuote,
  provider: AnchorProvider,
): Promise<string> {
  const transaction = await buildSwapTx(quote, provider.wallet.publicKey);
  const signed = await provider.wallet.signTransaction(transaction);
  return provider.connection.sendRawTransaction(signed.serialize(), {
    preflightCommitment: "confirmed",
    maxRetries: 3,
  });
}

/** The mint a Solana-side rail is represented by, checked before we rely on it. */
export function assertSolanaMint(rail: Rail): string {
  try {
    return new PublicKey(rail.sourceAddress).toBase58();
  } catch {
    throw new Error(`${rail.symbol} has no usable Solana mint`);
  }
}

/** Re-exported so callers building a readout do not need two imports. */
export { describeRoute };
