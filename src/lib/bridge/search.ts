import { amountIsUnusable, rebaseAmount } from "./amount";
import { labelFor } from "./format";
import {
  canSwapOnSolana,
  railCandidates,
  SOLANA_LIQUIDITY,
  type Rail,
  type Registry,
  type RegistryEntry,
} from "./rail";

import type { Network } from "$lib/models/tokens";

/**
 * Which token to hand the bridge, chosen by what it leaves the user with.
 *
 * The Omni Bridge moves exactly one registered token per transfer. Converting an
 * arbitrary token on one chain into an arbitrary token on another is therefore
 * three legs, and the middle one is a choice:
 *
 *     A on S ──swap on S──▶ R on S ──Omni──▶ R on D ──swap on D──▶ B on D
 *
 * `R` is the rail. Every token with an address on both chains is a candidate,
 * and the candidates are not interchangeable. For USDC on NEAR to SHITZU on
 * Solana, routing through wNEAR cannot work at all — Jupiter reports SHITZU as
 * not tradable on Solana — while swapping to SHITZU on NEAR first and bridging
 * SHITZU needs no second swap. So the rail is searched over, not configured.
 *
 * All amounts are in the base units of the chain they belong to:
 * `bridgedAmount` and `tokenFee` on the source chain, `arrivedAmount` and
 * `receiveAmount` on the destination. Crossing the bridge re-bases, because the
 * bridge preserves value rather than raw units.
 */

/** One swap leg, priced. Both amounts are in the output token's base units. */
export type SwapLeg = {
  /** The floor the aggregator guarantees. This is what ranking uses. */
  guaranteedOut: bigint;
  /** What it expects to deliver, which can be materially higher. */
  estimatedOut: bigint;
  /** DEXes behind the route, for the readout: `Rhea -> Plach`. */
  dexes: string[];
  /**
   * The route's own output token, which is not always what was asked for: a DEX
   * can need an intermediate representation and settle in two steps.
   */
  outputToken: string;
};

export type RouteRejectReason =
  /** The source token cannot be swapped into this rail on the source chain. */
  | "no-source-route"
  /** The rail cannot be swapped onward into the target on the destination. */
  | "no-target-route"
  /** The swap output does not cover the bridge's own fee, so nothing lands. */
  | "too-small"
  /**
   * This route needs a swap on Solana through a rail that has no known pool there.
   *
   * Not the same as `no-source-route` or `no-target-route`: nothing was asked of any
   * aggregator and nothing failed. The conversion is simply not offered over this
   * rail, which is a fact about the registry rather than about the market at this
   * instant — and it is what keeps a USDC → USDC conversion from asking the router
   * about all eight rails to discover that only two of them can carry it.
   */
  | "no-solana-liquidity"
  /**
   * The source already is the target, on the chain it is already on.
   *
   * Not a rejection in the sense of a failure: there is a route, and following it would
   * swap a token into itself. Reported so the form can say what is true, because the
   * empty result is otherwise indistinguishable from a market with nothing in it.
   */
  | "nothing-to-do";

export type RoutePlan = {
  /**
   * A same-chain conversion never touches the bridge, so it has no rail. Making
   * that explicit rather than inventing a fake one is what lets the UI skip the
   * bridge step entirely instead of rendering a step that does nothing.
   */
  kind: "bridge" | "swap";
  /** Null for a same-chain swap, which is not bridged. */
  rail: Rail | null;
  /** What the user is spending, for the route readout. */
  sourceSymbol: string;
  /** What they asked to receive, for the route readout. */
  targetSymbol: string;
  /**
   * The target's decimals on the destination chain, so a caller can judge
   * whether `receiveAmount` is a whole token without re-deriving it. This is not
   * the rail's figure: they differ for most tokens, and using the rail's would
   * reject every route into a low-decimal token.
   */
  targetDecimals: number;
  /** Null when the source token is the rail: there is nothing to swap. */
  sourceSwap: SwapLeg | null;
  /** Null when the target token is the rail: the bridge delivers it directly. */
  targetSwap: SwapLeg | null;
  /** Handed to the bridge, in the rail's source-chain base units. */
  bridgedAmount: bigint;
  /** What the bridge takes, in the rail's source-chain base units. */
  tokenFee: bigint;
  /** Paid on the source chain, in that chain's native units. */
  nativeFee: bigint;
  usdFee: number | null;
  /**
   * The rail on the destination chain, after the fee, in the rail's
   * destination-chain base units. This is the amount the destination swap takes.
   */
  arrivedAmount: bigint;
  /** What the user ends up with, in the target's base units. Null if nothing lands. */
  receiveAmount: bigint | null;
  /** The optimistic version of the same figure, for showing the spread. */
  receiveEstimated: bigint | null;
};

export type RejectedRoute = {
  /**
   * The rail this was rejected for, or null when the rejection is not about a rail at
   * all — which is the case for `nothing-to-do`, where no rail was ever considered.
   */
  rail: Rail | null;
  reason: RouteRejectReason;
};

export type RouteSearch = {
  /** Best first. Empty when nothing can be routed at all. */
  plans: RoutePlan[];
  rejected: RejectedRoute[];
};

export type BridgeFeeQuote = {
  tokenFee: bigint;
  nativeFee: bigint;
  usdFee: number | null;
};

/**
 * The three network calls the search needs, injected.
 *
 * Keeping them as parameters is what makes the ranking testable without a
 * network, and it is also where the chain-specific implementations plug in:
 * Jupiter on Solana, the Intear router on NEAR, and the Omni API for the fee.
 * Each returns null for "no route", which is a normal answer rather than a
 * failure.
 */
export type RouteSearchDeps = {
  /** Quote a swap on the source chain. */
  quoteSourceSwap: (rail: Rail, amountIn: bigint) => Promise<SwapLeg | null>;
  /** Quote a swap on the destination chain, given what has already arrived. */
  quoteTargetSwap: (rail: Rail, amountIn: bigint) => Promise<SwapLeg | null>;
  /** The bridge's fee for moving `amount` of `rail` from the source chain. */
  quoteBridgeFee: (rail: Rail, amount: bigint) => Promise<BridgeFeeQuote>;
  /**
   * Quote a swap that stays on the source chain, for when source and destination
   * are the same. There is no rail to price and no fee to quote, so it is a
   * separate dependency rather than a `quoteSourceSwap` with a null rail.
   */
  quoteSameChainSwap: (amountIn: bigint) => Promise<SwapLeg | null>;
};

export type SearchRoutesInput = {
  registry: Registry;
  source: Network;
  dest: Network;
  /**
   * The token the user is spending, identified whichever way the caller has it.
   *
   * A wallet knows a token by its address and the registry knows it by a key, and
   * the two disagree even for the same token: NEAR's wrapping contract is
   * `wrap.near` to a wallet and `NEAR` to the registry. So an id alone is not
   * enough to decide whether a swap is needed — see `sourceIsRail`.
   */
  sourceTokenId: string;
  /** The source token's address on the source chain, when the caller has it. */
  sourceAddress?: string;
  /** Registry id of the token they want to receive. */
  targetTokenId: string;
  /** The target's address on the destination chain, when the caller has it. */
  targetAddress?: string;
  /**
   * The target's symbol, when the caller already knows it.
   *
   * The mirror of `sourceSymbol`, and needed for the same reason. The receive
   * picker is almost entirely tokens the registry has never heard of, so
   * `labelFor` shortened their ids and "what happens" read `npro.n…near` where a
   * ticker belongs — for every target except the handful the bridge carries, which
   * is why the address looked like it was showing up selectively.
   */
  targetSymbol?: string;
  /**
   * The target's decimals on the destination chain, when the caller knows them.
   *
   * The receive picker holds them for every token it lists; the registry holds
   * them only for the tokens the bridge carries. Without this the search guessed
   * 18 for everything else, and the guess is not harmless — see
   * `targetDecimalsOnDest`.
   */
  targetDecimals?: number;
  /** In the source token's source-chain base units. */
  amount: bigint;
  /**
   * The source token's display symbol, when the caller already knows it.
   *
   * The source is usually a token the bridge registry has never heard of, and the
   * only thing the search is given is its address. Guessing a label from that
   * means falling back to a shortened address, which is how native SOL came out
   * as `So1111…1112` in the route readout — the wallet had already resolved the
   * symbol and it was thrown away on the way here.
   */
  sourceSymbol?: string;
  /** Force one rail, e.g. because the user pinned it. */
  pinnedRailId?: string;
  /**
   * Tokens a swap on Solana may involve. Defaults to `SOLANA_LIQUIDITY`.
   *
   * A parameter rather than a bare constant for the same reason the registry is one:
   * a test that is not about the liquidity rule should be able to state its own world
   * instead of quietly depending on which tokens happen to be listed today. The rule
   * itself is tested against the real list in `bridgeSolanaLiquidity`.
   */
  solanaLiquidity?: ReadonlySet<string>;
  /** Report every rejected rail rather than stopping at the first winner. */
  signal?: AbortSignal;
};

/**
 * Is the source token already the rail, so that no swap is needed at all?
 *
 * This is the difference between bridging a token and swapping into one, and it
 * is decided on the *address* as well as the key. A wallet hands over `wrap.near`
 * where the registry says `NEAR`, and comparing only the key made the best
 * near→Solana route ask the aggregator to quote a swap of `wrap.near` into
 * `wrap.near`. That is not a no-route answer, it is a 400, so the rail was thrown
 * away and the form reported that nothing was routable — the one conversion that
 * cannot fail was the one that failed.
 */
function sourceIsRail(
  sourceTokenId: string,
  sourceAddress: string | undefined,
  rail: Rail,
): boolean {
  if (sourceTokenId === rail.tokenId) return true;
  return (
    sourceAddress !== undefined &&
    sourceAddress !== "" &&
    sourceAddress === rail.sourceAddress
  );
}

/**
 * Is the target already the rail, so that it arrives in the form asked for?
 *
 * The mirror of `sourceIsRail`, and needed for the same reason: a bridged token
 * the registry has no key for is handed over as an address, and comparing that to
 * the rail's key turns the native bridge path into a self-swap. That is the path
 * for every token the bridge actually carries, so losing it costs the whole
 * direct-bridge route.
 */
function targetIsRail(
  targetTokenId: string,
  targetAddress: string | undefined,
  rail: Rail,
): boolean {
  if (targetTokenId === rail.tokenId) return true;
  return (
    targetAddress !== undefined &&
    targetAddress !== "" &&
    targetAddress === rail.destAddress
  );
}

/**
 * Decimals the target has on the chain it will be received on.
 *
 * Falls back to the rail's, which is exact for the native path where the two
 * are the same token, and a guess only for a target the registry does not know.
 */
/**
 * Decimals the target has on the chain it will be received on.
 *
 * Accepts either a registry key or a chain address, because both reach this
 * function: the picker hands over addresses, while an internal caller may know a
 * token by its registry key. Resolving a key first and falling back to an address
 * is what stops a key from silently landing on the 18-decimal default and
 * mispricing every amount derived from it.
 */
function targetDecimalsOnDest(
  registry: Registry,
  dest: Network,
  targetTokenId: string,
  /** What the caller already resolved, when it knows. */
  known?: number,
): number {
  // The caller's answer first, and it is not a convenience. The receive picker
  // holds the token's own metadata, and the registry only knows the tokens the
  // *bridge* carries — so for everything else this function had nothing to go on
  // and fell back to 18. That guess is not neutral: the whole-token check compares
  // the output against 10^18, and USDC has 6. A SOL → USDC conversion on Solana
  // quotes 122,066,448 units and is then thrown away for arriving "less than one
  // token". Same for any low-decimal target on either chain, which is most of a
  // memecoin list. The caller knows this number; guessing it here threw away
  // routes that were priced correctly a moment earlier.
  if (known !== undefined && Number.isInteger(known) && known >= 0)
    return known;
  const byKey = registry[targetTokenId];
  if (byKey) return byKey.decimals[dest] ?? 18;
  return entryForAddress(registry, dest, targetTokenId)?.decimals[dest] ?? 18;
}

/** The registry entry a chain address belongs to, if it is a bridge asset. */
export function entryForAddress(
  registry: Registry,
  network: Network,
  address: string,
): RegistryEntry | undefined {
  const needle = address.toLowerCase();
  for (const token of Object.values(registry)) {
    const raw = token.addresses[network];
    if (!raw) continue;
    // Compared without the prefix the aggregator would reject, and case-folded
    // because EVM addresses are hex and case does not matter for them.
    const normalised = network === "near" ? raw.replace(/^nep141:/, "") : raw;
    if (normalised.toLowerCase() === needle) return token;
  }
  return undefined;
}

/**
 * The registry key for a chain address.
 *
 * Needed because the rail search reasons in registry keys while the picker
 * reasons in addresses, and a target that is also a bridge asset is the one place
 * the two meet.
 */
export function tokenIdForAddress(
  registry: Registry,
  network: Network,
  address: string,
): string | undefined {
  for (const [key, token] of Object.entries(registry)) {
    if (entryForAddress(registry, network, address) === token) return key;
  }
  return undefined;
}

/**
 * Score one rail, or explain why it cannot carry the transfer.
 *
 * The three legs are strictly ordered — the fee is a percentage of what the
 * source swap produced, and the destination swap is a percentage of what
 * survived the fee — so this cannot be parallelised within a rail. Across rails
 * it can, and the caller does that.
 */
async function planForRail(
  rail: Rail,
  input: SearchRoutesInput,
  deps: RouteSearchDeps,
): Promise<RoutePlan | RejectedRoute> {
  const {
    sourceTokenId,
    targetTokenId,
    amount,
    registry,
    dest,
    sourceSymbol,
    solanaLiquidity = SOLANA_LIQUIDITY,
  } = input;

  // Which rail can carry this route at all.
  //
  // A swap happening on the Solana side means this rail's liquidity *there* decides
  // whether the route can exist, and only wNEAR and SHITZU are known to have any. So
  // the rail is what is restricted — not the token being swapped. That distinction is
  // the whole rule: gating the target instead would forbid USDC → USDC, which is the
  // deepest pair on Solana and the conversion most likely to be wanted, and it would
  // do so only after asking the router about every rail in the registry.
  //
  // A straight bridge asks nothing of any pool, so a rail with no Solana liquidity
  // still bridges directly and is not rejected here.
  const needsSourceSwap = !sourceIsRail(
    sourceTokenId,
    input.sourceAddress,
    rail,
  );
  const needsTargetSwap = !targetIsRail(
    targetTokenId,
    input.targetAddress,
    rail,
  );
  if (
    (input.source === "solana" && needsSourceSwap) ||
    (input.dest === "solana" && needsTargetSwap)
  ) {
    const onSolana =
      input.source === "solana" ? rail.sourceAddress : rail.destAddress;
    if (!canSwapOnSolana(registry, rail.tokenId, onSolana, solanaLiquidity)) {
      return { rail, reason: "no-solana-liquidity" };
    }
  }

  // Leg 1. The source token may itself be a bridgeable token, in which case it
  // is handed straight over and there is no swap and no route to find.
  let bridgedAmount = amount;
  let sourceSwap: SwapLeg | null = null;
  if (needsSourceSwap) {
    sourceSwap = await deps.quoteSourceSwap(rail, amount);
    if (!sourceSwap) return { rail, reason: "no-source-route" };
    bridgedAmount = sourceSwap.guaranteedOut;
  }

  if (bridgedAmount <= 0n) return { rail, reason: "too-small" };

  // The bridge's fee, taken out of the amount rather than added on top, so an
  // amount at or below the fee cannot arrive at all.
  //
  // Quoted for *every* route, including a straight bridge with no swap in it. It used
  // to be skipped when there was no source swap, which is precisely the straight-bridge
  // case — so the simplest route in the form was also the only one whose fee was
  // reported as nothing, while the bridge went on charging it. The summary said "no
  // bridge fee" and the deposit took one, and the two numbers were both true.
  const fee = await deps.quoteBridgeFee(rail, bridgedAmount);
  if (bridgedAmount <= fee.tokenFee) return { rail, reason: "too-small" };

  const arrivedAmount = rebaseAmount(
    bridgedAmount - fee.tokenFee,
    rail.sourceDecimals,
    rail.destDecimals,
  );
  if (arrivedAmount <= 0n) return { rail, reason: "too-small" };

  // Leg 3. Likewise null when the rail *is* the target, which is the native
  // bridge path: the tokens land already in the form the user asked for.
  let targetSwap: SwapLeg | null = null;
  let receiveAmount: bigint | null = arrivedAmount;
  let receiveEstimated: bigint | null = arrivedAmount;

  if (needsTargetSwap) {
    targetSwap = await deps.quoteTargetSwap(rail, arrivedAmount);
    if (!targetSwap) return { rail, reason: "no-target-route" };
    receiveAmount = targetSwap.guaranteedOut;
    receiveEstimated = targetSwap.estimatedOut;
  }

  // A route that arrives with nothing to show for it is real but useless: rounding it
  // in the summary would read as a bug. What counts as nothing is not the same
  // question on every chain — see `amountIsUnusableThen` for why SOL is the case that
  // broke this.
  if (
    receiveAmount !== null &&
    amountIsUnusable(
      receiveAmount,
      dest,
      targetDecimalsOnDest(registry, dest, targetTokenId, input.targetDecimals),
    )
  ) {
    return { rail, reason: "too-small" };
  }

  return {
    kind: "bridge",
    rail,
    // Resolved through the same label rules the form uses, so a source token the
    // registry does not know — which is most of them, since it can be anything
    // the wallet holds — is shortened rather than shown as a raw mint. A 44
    // character address where a symbol belongs is unreadable, and it was being
    // rendered in the route readout as if it were the token's name. A symbol the
    // caller already resolved beats both.
    sourceSymbol: sourceSymbol ?? labelFor(sourceTokenId, registry),
    targetSymbol: input.targetSymbol ?? labelFor(targetTokenId, registry),
    targetDecimals: targetDecimalsOnDest(
      registry,
      dest,
      targetTokenId,
      input.targetDecimals,
    ),
    sourceSwap,
    targetSwap,
    bridgedAmount,
    tokenFee: fee.tokenFee,
    nativeFee: fee.nativeFee,
    usdFee: fee.usdFee,
    arrivedAmount,
    receiveAmount,
    receiveEstimated,
  };
}

/**
 * Rank on the guaranteed figure, then on the estimate.
 *
 * The estimate is the number a user cannot rely on, and on a thin pool the gap
 * between the two is where a bad route hides: the same query at 1% slippage
 * returns nothing for a pair that routes fine at 3%, so a route's headline
 * number says much less than its floor does. Ties fall back to the estimate and
 * then to the registry's order, so the list is stable between identical
 * searches rather than reshuffling on every keystroke.
 */
function rank(plans: RoutePlan[]): RoutePlan[] {
  return [...plans].sort((a, b) => {
    const aFloor = a.receiveAmount ?? 0n;
    const bFloor = b.receiveAmount ?? 0n;
    if (aFloor !== bFloor) return aFloor > bFloor ? -1 : 1;

    const aBest = a.receiveEstimated ?? 0n;
    const bBest = b.receiveEstimated ?? 0n;
    if (aBest !== bBest) return aBest > bBest ? -1 : 1;

    return 0;
  });
}

/**
 * A same-chain conversion: one swap, no bridge, no fee.
 *
 * Kept apart from the rail search because there is nothing to search over — the
 * aggregator either routes the pair or it does not — and because a plan with no
 * rail must not claim a bridged amount or a bridge fee. Rendering a zero-fee
 * bridge would be a lie about what the transfer does.
 */
async function searchSameChain(
  input: SearchRoutesInput,
  deps: RouteSearchDeps,
): Promise<RouteSearch> {
  const { source, targetTokenId, amount, signal, registry, sourceSymbol } =
    input;
  // The source *is* the target. There is nothing to do, which is not the same as there
  // being no route — saying so told the user their own token could not be moved to the
  // chain it is already on. It costs no request: the check is on the inputs, before the
  // router is involved at all.
  if (sourceTokenIdIsTarget(input)) {
    return {
      plans: [],
      rejected: [{ rail: null, reason: "nothing-to-do" }],
    };
  }

  if (amount <= 0n) {
    return { plans: [], rejected: [] };
  }

  let leg: SwapLeg | null;
  try {
    leg = await deps.quoteSameChainSwap(amount);
  } catch (err) {
    // A warning, not an error: the search handles it and answers "no route", and a
    // single aggregator hiccup is not a broken form. It is logged because that answer
    // is indistinguishable from a market with no route, and someone reading the console
    // is the only way to tell those apart.
    console.warn("[bridge] same-chain quote failed", err);
    return { plans: [], rejected: [] };
  }

  if (signal?.aborted) return { plans: [], rejected: [] };

  if (!leg || leg.guaranteedOut <= 0n) {
    return { plans: [], rejected: [] };
  }
  if (
    amountIsUnusable(
      leg.guaranteedOut,
      source,
      targetDecimalsOnDest(
        input.registry,
        source,
        targetTokenId,
        input.targetDecimals,
      ),
    )
  ) {
    return { plans: [], rejected: [] };
  }

  return {
    plans: [
      {
        kind: "swap",
        rail: null,
        sourceSymbol: sourceSymbol ?? labelFor(input.sourceTokenId, registry),
        targetSymbol: input.targetSymbol ?? labelFor(targetTokenId, registry),
        targetDecimals: targetDecimalsOnDest(
          input.registry,
          source,
          targetTokenId,
          input.targetDecimals,
        ),
        sourceSwap: leg,
        targetSwap: null,
        bridgedAmount: 0n,
        tokenFee: 0n,
        nativeFee: 0n,
        usdFee: null,
        arrivedAmount: 0n,
        receiveAmount: leg.guaranteedOut,
        receiveEstimated: leg.estimatedOut,
      },
    ],
    rejected: [],
  };
}

/** Spending a token to receive it is not a conversion. */
/**
 * Is the source already the target?
 *
 * By address as well as by id, because a wallet knows a token by its contract while the
 * registry knows it by a key, and the two disagree even for the same token — `wrap.near`
 * against `NEAR`. Comparing only the id asked the router to quote a swap of a token into
 * itself, which is a request whose answer cannot be used for anything.
 */
function sourceTokenIdIsTarget(input: SearchRoutesInput): boolean {
  if (input.sourceTokenId === input.targetTokenId) return true;
  const source = input.sourceAddress;
  const target = input.targetAddress;
  return (
    source !== undefined &&
    source !== "" &&
    target !== undefined &&
    target !== "" &&
    source === target
  );
}

/**
 * Find every way to get `amount` of one token to `dest` as another.
 *
 * The candidate rails are scored in parallel. That matters for latency: there
 * are seven NEAR/Solana rails, and each one costs three sequential round trips,
 * so scoring them one at a time would take the sum rather than the max. The
 * legs *within* a rail stay sequential, because each depends on the last.
 */
export async function searchRoutes(
  input: SearchRoutesInput,
  deps: RouteSearchDeps,
): Promise<RouteSearch> {
  const { registry, source, dest, amount, pinnedRailId, signal } = input;

  if (amount <= 0n) {
    return { plans: [], rejected: [] };
  }

  // Same chain in and out: no bridge is involved at all, it is a single swap.
  // This is not a degenerate case. It is how a user buys OMGY with USDC on NEAR
  // when OMGY has no Solana liquidity, and it is the only route that works at all
  // for a token that exists on just one chain.
  if (source === dest) {
    return searchSameChain(input, deps);
  }

  let candidates = railCandidates(registry, source, dest);
  if (pinnedRailId) {
    candidates = candidates.filter((rail) => rail.tokenId === pinnedRailId);
  }

  const settled = await Promise.all(
    candidates.map((rail) =>
      planForRail(rail, input, deps).catch((err): RejectedRoute => {
        // One rail failing to quote must not lose the others: three to six of
        // the seven have no pool at any moment, and an aggregator hiccup on one
        // of them should read as "that rail is out", not as a dead form.
        //
        // A warning rather than an error, for that reason. This is the ordinary shape
        // of a route search, and logging it at error severity made a working search
        // look like a broken one to anyone reading the console.
        console.warn(`[bridge] route search failed for ${rail.tokenId}`, err);
        return { rail, reason: "no-source-route" };
      }),
    ),
  );

  // A superseded search still resolves; its caller has already moved on, and
  // returning its results would overwrite fresher ones.
  if (signal?.aborted) return { plans: [], rejected: [] };

  const plans: RoutePlan[] = [];
  const rejected: RejectedRoute[] = [];
  for (const outcome of settled) {
    if ("reason" in outcome) rejected.push(outcome);
    else plans.push(outcome);
  }

  return { plans: rank(plans), rejected };
}

/**
 * The path in one line, for the readout above the fee breakdown.
 *
 * The rail is only shown when it is a genuine intermediate. When the source or
 * the target *is* the rail, listing it would print the same symbol twice
 * (`USDT -> SHITZU -> SHITZU`) and imply a swap that is not happening.
 */
export function describePlan(plan: RoutePlan): string {
  const viaRail =
    plan.rail !== null && plan.sourceSwap !== null && plan.targetSwap !== null;
  return viaRail && plan.rail
    ? `${plan.sourceSymbol} -> ${plan.rail.symbol} -> ${plan.targetSymbol}`
    : `${plan.sourceSymbol} -> ${plan.targetSymbol}`;
}

/** True when the plan is a plain bridge with no swap on either side. */
export function isNativePlan(plan: RoutePlan): boolean {
  return (
    plan.kind === "bridge" &&
    plan.sourceSwap === null &&
    plan.targetSwap === null
  );
}

/**
 * A stable identity for a plan, for list keys and for pinning a route.
 *
 * A same-chain swap has no rail, so keying on `rail.tokenId` would collapse every
 * swap plan onto `undefined` and make a list of them unkeyable. The `swap` prefix
 * cannot collide with a registry id, which is always a chain-prefixed address.
 */
export function planKey(plan: RoutePlan): string {
  return plan.rail ? plan.rail.tokenId : `swap:${plan.targetSymbol}`;
}

/** The token the bridge would carry, or null when nothing is bridged. */
export function planRailId(plan: RoutePlan): string | null {
  return plan.rail?.tokenId ?? null;
}
