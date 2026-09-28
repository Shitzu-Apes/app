import { formatBaseUnits } from "./amount";
import { CHAINS } from "./chains";
import { formatUsd, usdFor } from "./format";
import type { RoutePlan, SwapLeg } from "./search";

import type { Network } from "$lib/models/tokens";

/**
 * A route spelled out as the transactions it actually is.
 *
 * A route is up to three separate operations, on two different chains, signed by
 * two different wallets, and separated in time by the bridge's own finalisation
 * wait. "Via SHITZU" says none of that: which chain each swap happens on, what
 * the bridge is carrying, and what the user has to sign and when.
 *
 * Showing the steps *before* anything is signed is the point. The destination
 * swap in particular cannot be signed up front — the funds do not exist yet — so
 * the user is signing three times across two wallets and should be able to see
 * that coming rather than discover it.
 */

export type StepKind = "swap" | "bridge" | "receive";

export type StepState = "pending" | "active" | "done" | "failed";

export type RouteStep = {
  id: string;
  kind: StepKind;
  /** Which chain this step happens on. Null for the final receive, which is on both. */
  chain: Network | null;
  /** The line under the title: what moves, and into what. */
  detail: string;
  /** The headline for the step. */
  title: string;
  /** Where the funds are at the end of this step. */
  amount: bigint | null;
  amountDecimals: number;
  symbol: string;
  state: StepState;
  /** Venues, for a swap. Empty for the bridge, which has none. */
  venues: string[];
};

function swapVenues(leg: SwapLeg | null): string[] {
  return leg ? [...new Set(leg.dexes)] : [];
}

function chainName(network: Network): string {
  return CHAINS[network].name;
}

/**
 * The ordered steps for a route, all pending.
 *
 * Built from the plan rather than from the request, so it is only ever called for
 * a route that actually exists. A step with nothing to do is omitted rather than
 * rendered as a no-op: a plain bridge is two steps, not three with an empty one
 * in the middle, and a "Convert" button on a two-step route reads as broken.
 */
export function planSteps(
  plan: RoutePlan,
  source: Network,
  dest: Network,
): RouteStep[] {
  const steps: RouteStep[] = [];
  const rail = plan.rail;

  // A same-chain conversion has no bridge in it. Rendering a bridge step for it
  // would promise a cross-chain transfer, a wait, and a fee that do not apply.
  if (!rail) {
    steps.push({
      id: "swap",
      kind: "swap",
      chain: source,
      title: `Swap ${plan.sourceSymbol} → ${plan.targetSymbol}`,
      detail:
        (plan.sourceSwap
          ? [...new Set(plan.sourceSwap.dexes)].join(" → ")
          : "") || `on ${chainName(source)}`,
      amount: plan.receiveAmount,
      amountDecimals: plan.targetDecimals,
      symbol: plan.targetSymbol,
      state: "pending",
      venues: plan.sourceSwap ? [...new Set(plan.sourceSwap.dexes)] : [],
    });
    // One step, and no trailing "receive".
    //
    // There used to be a second step here saying "Receive X on Near", carrying the same
    // symbol and the same amount as the swap directly above it. The cross-chain branch
    // below drops its receive step for precisely this reason and this one did not, so
    // the one-step case — the *simplest* route in the form — was the only one that read
    // as though something were still to happen. The swap step already carries the amount
    // that lands, and the summary above it already says what you receive.
    return steps;
  }

  if (plan.sourceSwap) {
    steps.push({
      id: "swap-in",
      kind: "swap",
      chain: source,
      title: `Swap ${plan.sourceSymbol} → ${rail.symbol}`,
      detail:
        swapVenues(plan.sourceSwap).join(" → ") || `on ${chainName(source)}`,
      amount: plan.sourceSwap.guaranteedOut,
      amountDecimals: rail.sourceDecimals,
      symbol: rail.symbol,
      state: "pending",
      venues: swapVenues(plan.sourceSwap),
    });
  }

  steps.push({
    id: "bridge",
    kind: "bridge",
    chain: source,
    // Names the asset the bridge is carrying, which is the thing a user cannot
    // otherwise see: everything they typed in, and everything they get out, are
    // different tokens from what crosses the middle.
    title: `Bridge ${rail.symbol} ${chainName(source)} → ${chainName(dest)}`,
    // The fee belongs on the step that charges it. The bridge takes two different
    // things — a slice of the bridged token, and the source chain's own gas — and
    // the second one is the one that goes missing: a Solana → NEAR transfer spends
    // ~0.000081 SOL on gas whatever the amount, and that value left the account
    // while the step said nothing about it.
    detail: ["Omni Bridge", costSummary(plan, source)]
      .filter(Boolean)
      .join(" · "),
    amount: plan.bridgedAmount,
    amountDecimals: rail.sourceDecimals,
    symbol: rail.symbol,
    state: "pending",
    venues: [],
  });

  if (plan.targetSwap) {
    steps.push({
      id: "swap-out",
      kind: "swap",
      chain: dest,
      title: `Swap ${rail.symbol} → ${plan.targetSymbol}`,
      detail:
        swapVenues(plan.targetSwap).join(" → ") || `on ${chainName(dest)}`,
      amount: plan.targetSwap.guaranteedOut,
      amountDecimals: plan.targetDecimals,
      symbol: plan.targetSymbol,
      state: "pending",
      venues: swapVenues(plan.targetSwap),
    });
  }

  // No trailing "receive" step for a cross-chain route. It repeated the last real
  // step's symbol and its exact amount, so a plan read "bridge X, then receive X"
  // — two entries, one fact, and the second one claiming nothing is left to do
  // while the swap that produces it is still pending. The amount that lands is
  // already the amount on the final swap, or on the bridge itself when the target
  // is the rail.
  //
  // The same-chain route above keeps its own, because there it carries the only
  // statement that there is no bridge and no bridge fee.

  return steps;

  return steps;
}

/**
 * Mark one step in flight and everything before it done.
 *
 * Steps are sequential by construction — the destination swap cannot start before
 * the bridge has finalised — so progress is a position rather than a set. Deriving
 * it from a single index is what keeps the three renderers (the pre-flight list,
 * the progress list, and the error state) from disagreeing about what "step 2" means.
 */
export function withProgress(
  steps: RouteStep[],
  activeIndex: number,
  failed = false,
  /**
   * True when the step at `activeIndex` is waiting on the user rather than running.
   *
   * A cross-chain conversion stops between the bridge and the destination swap,
   * because the swap's signature has to answer a fresh click — the first one is
   * minutes old by then and its popups would be blocked. Nothing is in flight at
   * that moment, so the step must not read as running: a bridge that has finalised
   * showing a spinner is the app disagreeing with itself about whether the money
   * arrived.
   */
  awaiting = false,
): RouteStep[] {
  return steps.map((step, index) => {
    if (index < activeIndex) return { ...step, state: "done" };
    if (index === activeIndex) {
      if (failed) return { ...step, state: "failed" };
      return { ...step, state: awaiting ? "pending" : "active" };
    }
    return { ...step, state: "pending" };
  });
}

/** How far a step's output is from the best route's, as a signed percentage. */
export function percentBehind(plan: RoutePlan, best: RoutePlan): number | null {
  if (plan.receiveAmount === null || best.receiveAmount === null) return null;
  if (best.receiveAmount <= 0n) return null;
  if (plan.receiveAmount === best.receiveAmount) return 0;
  const ratio = Number(plan.receiveAmount) / Number(best.receiveAmount);
  if (!Number.isFinite(ratio)) return null;
  return Math.round((1 - ratio) * 1000) / 10;
}

/** The step that is running, or null before the transfer starts. */
export function activeStep(steps: RouteStep[]): RouteStep | undefined {
  return steps.find((step) => step.state === "active");
}

/** Whether every step has completed. */
export function isComplete(steps: RouteStep[]): boolean {
  return steps.length > 0 && steps.every((step) => step.state === "done");
}

/**
 * The whole cost of the transfer, as one string.
 *
 * Both halves matter and they are denominated differently. The token fee is taken
 * out of the bridged amount, so it reduces what arrives; the native fee is paid
 * out of the wallet's SOL or NEAR and has nothing to do with the amount. Showing
 * only the first is what made the earlier summary look free.
 */
export function costSummary(plan: RoutePlan, source: Network): string {
  // A same-chain swap is charged by the DEX, not the bridge, and the aggregator
  // already reflects that in the quoted output. Showing a zero bridge fee would
  // imply a cost that is never itemised anywhere.
  if (plan.kind === "swap" || !plan.rail) return "";
  const chain = CHAINS[source];
  const parts: string[] = [];

  if (plan.tokenFee > 0n) {
    // The sign is applied here rather than shown as a leading `−`, because the
    // fee is a deduction from the amount and reads as one next to the amount
    // itself. The API returns it as a positive number, which is why it is easy to
    // render as a charge that is *added*.
    parts.push(
      `${formatBaseUnits(plan.tokenFee, plan.rail.sourceDecimals)} ${plan.rail.symbol}`,
    );
  }
  if (plan.nativeFee > 0n) {
    parts.push(
      `${formatBaseUnits(plan.nativeFee, chain.nativeDecimals)} ${chain.nativeSymbol}`,
    );
  }

  const total = plan.usdFee !== null && plan.usdFee > 0 ? plan.usdFee : null;
  const body = parts.join(" + ");
  // The dollar figure is the total, so it reads as a sum rather than as another
  // line item in the chain.
  return total === null
    ? body
    : `${body}${body ? "  " : ""}≈ ${formatUsd(total)}`;
}

/** What the user ends up with, with its value when we can price it. */
export function receiveSummary(
  plan: RoutePlan,
  price: number | null | undefined,
): string {
  if (plan.receiveAmount === null) return "";
  const amount = `${formatBaseUnits(plan.receiveAmount, plan.targetDecimals)} ${plan.targetSymbol}`;
  const usd = usdFor(plan.receiveAmount, plan.targetDecimals, price);
  return usd ? `${amount}  ≈ ${usd}` : amount;
}

/** The source amount in tokens, for the "you send" line. */
export function sendSummary(
  amount: bigint,
  decimals: number,
  symbol: string,
): string {
  return `${formatBaseUnits(amount, decimals)} ${symbol}`;
}
