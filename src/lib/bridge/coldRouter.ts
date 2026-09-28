import type { RouteRejectReason, RouteSearch } from "./search";

/**
 * Recognising a cold router, and not mistaking it for a market with no route.
 *
 * The Intear router answers `[]` for a pair that routes moments later, at a rate of
 * 10–30% and independently of the amount. It is not a slow router or a rate limit —
 * it is a router that is sometimes simply not there. Nothing in the response
 * distinguishes the two cases, so the decision of what to do about an empty result
 * has to be made by the caller, from what it already knows about the request.
 */

/**
 * Rejections that are arithmetic or policy, not the router being cold.
 *
 * Asking again cannot change any of them, so an empty result made only of these is
 * an answer rather than a failure to answer — and retrying it would add a second of
 * waiting to every "no route" the user is entitled to.
 */
export const DETERMINISTIC_REJECTIONS: readonly RouteRejectReason[] = [
  // The amount cannot cover the bridge's fee, or does not arrive as a whole token.
  "too-small",
  // A swap on Solana with a token that has no known pool there. A closed list.
  "no-solana-liquidity",
];

/**
 * Is an empty result worth asking the router about again?
 *
 * Seven rails all landing empty inside the same cold window is not seven independent
 * facts — it is one cold window observed seven times. The honest reading of that is
 * "ask again in a moment", not "no route available", and reporting it as the latter
 * is what makes a live market look dead.
 *
 * This used to be promised in a comment in `intear.ts` and never built, so a single
 * cold window became a flat refusal with nothing behind it.
 */
export function worthRetryingEmpty(result: RouteSearch): boolean {
  if (result.plans.length > 0) return false;
  return result.rejected.some(
    (rejection) => !DETERMINISTIC_REJECTIONS.includes(rejection.reason),
  );
}

/**
 * How long to wait before each re-run of the whole search, in milliseconds.
 *
 * Spacing is the part that actually works, and it is measured rather than guessed:
 * thirty identical requests fired back to back produced a run of *six* consecutive
 * empties, while the same requests spaced 250 ms apart never produced a run longer
 * than two. The cold window is a couple of seconds, not a single request, so an
 * immediate retry is not a retry at all. Growing because there is no reason to be
 * impatient by the fourth attempt, and because a cold window that has already survived
 * two waits is worth waiting out properly.
 *
 * Four re-runs, so five searches in the worst case. That is a deliberate choice over
 * a smaller budget, and the arithmetic is the argument: at the measured 10–30% empty
 * rate, two searches still fail about 9% of the time — roughly one conversion in
 * eleven reported as having no route while the market is open. Five drop that to
 * 0.3^5, about one in four hundred. That is not a claim of perfection: the worst case
 * measured is a 30% empty rate, and the estimate assumes the attempts are
 * independent, which spacing makes more true and does not make certain.
 *
 * It is affordable because the rail whitelist cut a search from eight rails to two.
 * One search is now four requests rather than sixteen, and these waits are only
 * reached when every rail came back empty, so the common path got cheaper to pay for
 * the unhappy one.
 *
 * Jittered, because several people hitting a cold router at once and retrying in
 * lockstep is how the burst they are all waiting out gets reproduced.
 */
export const EMPTY_RETRY_DELAYS_MS = [600, 1200, 2400, 4000] as const;

/** The widest jitter added to a single wait, as a fraction of the wait itself. */
const JITTER_RATIO = 0.35;

/**
 * One wait, jittered by up to a third of itself.
 *
 * A fixed number of milliseconds would put every waiting user back on the router at
 * the same instant, which is the behaviour the jitter exists to prevent.
 */
export function emptyRetryDelay(index: number): number {
  const base =
    EMPTY_RETRY_DELAYS_MS[Math.min(index, EMPTY_RETRY_DELAYS_MS.length - 1)];
  return base + Math.random() * base * JITTER_RATIO;
}
