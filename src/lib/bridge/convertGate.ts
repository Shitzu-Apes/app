import { amountIsUnusable } from "./amount";
import type { RoutePlan, RouteSearch } from "./search";

import type { Network } from "$lib/models/tokens";

/**
 * Whether the Convert form may be submitted, and what its button should say.
 *
 * Separate from `bridgeGate` in `amount.ts`, which decides the same question for
 * the fixed Solana-to-NEAR-wNEAR sheet. That one takes a single `bridgedWnear`
 * and a single fee; this one takes a ranked list of routes that may be empty,
 * and has to explain *why* it is empty, because "no route available" and "still
 * looking" are very different things to a user who has already entered an
 * amount.
 *
 * Kept free of Svelte and of the network so the decision is testable on its own,
 * which matters more here than usual: this is the function standing between a
 * signed transaction and a transfer that cannot settle.
 */

export type ConvertGateInput = {
  /** In the source token's source-chain base units. Null while parsing. */
  amount: bigint | null;
  /** Null while a search is in flight, or before one has been run. */
  search: RouteSearch | null;
  searching: boolean;
  /** The search itself failed, as opposed to finding nothing. */
  searchFailed: boolean;
  sourceConnected: boolean;
  destConnected: boolean;
  /**
   * The destination chain.
   *
   * Needed because "too small to show" is not the same question on every chain: SOL has
   * nine decimals and is traded in fractions, while a stablecoin is thought of in whole
   * units. The gate has to apply the same rule the search applied, or a route the search
   * accepted is refused on the button.
   */
  dest: Network;
  isSubmitting: boolean;
  /**
   * The first leg has landed and the destination swap is waiting on a button
   * press.
   *
   * A separate state because the swap is genuinely a second decision, not a
   * continuation: the user can see the balance arrive before committing to it, and
   * — on NEAR — the press has to be a real user gesture or the wallet's popup is
   * blocked. "Converting…" would be a lie here, and "Done" worse.
   */
  awaitingFinal: boolean;
  /**
   * The pending press is the bridge deposit rather than the destination swap, so the
   * button says so.
   *
   * A split NEAR route stops after the swap, and the press that finishes it signs
   * the deposit. Calling that "Swap into the target token" would name a step the
   * user has not reached, and the difference is which signature they are about to
   * give.
   */
  awaitingDeposit: boolean;
  /** True once the transfer has landed, so the form stops offering it. */
  done: boolean;
  /** Spendable source balance, already net of any gas that must be held back. */
  available: bigint | null;
  /** Balance of the source chain's native token, for the network fee. */
  nativeBalance: bigint | null;
  /** Native units that must stay put to pay for the deposit. */
  nativeReserve: bigint;
  /**
   * The aggregator is mainnet-only, and the testnet bridge contract has no
   * wNEAR registered, so a testnet deposit can never settle. Better to say so
   * than to let someone sign two transactions that go nowhere.
   */
  supported: boolean;
};

export type ConvertGate = {
  canSubmit: boolean;
  label: string;
  /** Nothing can carry this transfer at all. */
  noRoute: boolean;
  /** The source already is the target, on the chain it is already on. */
  nothingToDo: boolean;
  /** A route exists but nothing would arrive. */
  tooSmall: boolean;
  insufficientBalance: boolean;
  insufficientGas: boolean;
  needsSourceConnect: boolean;
  needsDestConnect: boolean;
};

/**
 * Never block on data we do not have.
 *
 * An unknown balance is not a reason to disable a form, only a known-too-small
 * amount is. Otherwise a slow RPC leaves the button greyed out with no
 * explanation, which reads as broken rather than as loading.
 */
export function convertGate({
  amount,
  search,
  searching,
  searchFailed,
  sourceConnected,
  destConnected,
  dest,
  isSubmitting,
  awaitingFinal,
  awaitingDeposit,
  done,
  available,
  nativeBalance,
  nativeReserve,
  supported,
}: ConvertGateInput): ConvertGate {
  const plans = search?.plans ?? [];

  const hasAmount = amount !== null && amount > 0n;
  const needsSourceConnect = !sourceConnected;
  const needsDestConnect = sourceConnected && !destConnected;

  // A route is only usable if it actually delivers something. The search already
  // drops the ones that do not, so this is a backstop rather than the rule.
  const usable = plans.filter(
    (plan: RoutePlan) => plan.receiveAmount !== null && plan.receiveAmount > 0n,
  );
  // A null search means none has run yet, which is not the same as one that ran
  // and found nothing. Reporting "no route available" before the first quote
  // lands would be a claim the app has not earned.
  // "Nothing to do" is not "no route", and the difference is the whole answer: the user
  // asked to move a token to the chain it is already on. A generic "no route available"
  // there is a claim about the market that is plainly false.
  const nothingToDo =
    hasAmount &&
    sourceConnected &&
    destConnected &&
    search !== null &&
    !searching &&
    !searchFailed &&
    usable.length === 0 &&
    search.rejected.length > 0 &&
    search.rejected.every((r) => r.reason === "nothing-to-do");

  const noRoute =
    hasAmount &&
    // Not a verdict about the market while a wallet is missing: the fee quote
    // needs a recipient on the destination chain, and without one every route
    // fails to price, which looks identical to nothing being routable.
    sourceConnected &&
    destConnected &&
    search !== null &&
    !searching &&
    !searchFailed &&
    usable.length === 0 &&
    !nothingToDo;
  const tooSmall =
    hasAmount && usable.length > 0 && !hasWholeToken(usable, dest);

  const insufficientBalance =
    hasAmount && available !== null && amount > available;
  // Bridging costs native gas whatever token is being moved, so this is checked
  // independently of the source balance.
  const insufficientGas =
    nativeBalance !== null && nativeBalance < nativeReserve;

  const canSubmit =
    supported &&
    !done &&
    // A pending final leg is the one thing that must stay pressable: it is the
    // press that completes the conversion. Everything else about the form is
    // finished, and the usual guards would otherwise disable the only button
    // that matters.
    (awaitingFinal || awaitingDeposit || !isSubmitting) &&
    !searching &&
    !searchFailed &&
    sourceConnected &&
    destConnected &&
    hasAmount &&
    usable.length > 0 &&
    !tooSmall &&
    !insufficientBalance &&
    !insufficientGas;

  let label: string;
  if (!supported) label = "Mainnet only";
  // In-flight outranks everything, including done: both being true means the
  // destination swap is still running after the deposit landed, and "Done" would
  // understate it.
  else if (isSubmitting) label = "Converting…";
  // Then done, which is terminal: a finished transfer says so even if a stale flag
  // is still set, because the button is inert either way and "Swap into the target
  // token" on a completed conversion would read as an instruction to redo it.
  else if (done) label = "Done";
  // Then the pending final leg, which outranks the idle states: the route, the
  // amount and the connections are all settled, and what the button now does is
  // finish the conversion.
  else if (awaitingDeposit) label = "Bridge to the destination chain";
  else if (awaitingFinal) label = "Swap into the target token";
  else if (needsSourceConnect) label = "Connect source wallet";
  else if (needsDestConnect) label = "Connect destination wallet";
  else if (!hasAmount) label = "Enter an amount";
  else if (searching) label = "Finding a route…";
  else if (searchFailed) label = "Couldn't price this — try again";
  else if (insufficientBalance) label = "Insufficient balance";
  else if (insufficientGas) label = "Not enough for fees";
  else if (nothingToDo) label = "Already on this chain";
  else if (noRoute) label = "No route available";
  else if (tooSmall) label = "Amount too small";
  else label = "Convert";

  return {
    canSubmit,
    label,
    noRoute,
    nothingToDo,
    tooSmall,
    insufficientBalance,
    insufficientGas,
    needsSourceConnect,
    needsDestConnect,
  };
}

/**
 * True when at least one route delivers a whole token.
 *
 * The search already rejects sub-unit outputs, so this should always hold. It is
 * kept as a second gate because it answers from the plan's own `targetDecimals`
 * while the search answered from the registry directly: if those two ever drift,
 * the button should disable rather than submit a transfer whose balance rounds
 * to zero.
 */
function hasWholeToken(plans: RoutePlan[], dest: Network): boolean {
  return plans.some(
    (plan) =>
      plan.receiveAmount !== null &&
      plan.receiveAmount > 0n &&
      // The same rule the search applies, so the button and the route list cannot
      // disagree. This asked "less than one whole token" — which rejected every swap
      // into SOL below a whole SOL, and would have left the button reading "Amount too
      // small" on a route the search had just accepted once that was fixed.
      !amountIsUnusable(plan.receiveAmount, dest, plan.targetDecimals),
  );
}
