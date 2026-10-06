import { intearQuoter, quoteOnSolana } from "./aggregators";
import { getBridgeFee } from "./fee";
import { railAssetOnArrival } from "./rail";
import {
  targetCandidates,
  TOKENS,
  type BridgeableToken,
  type Registry,
} from "./registry";
import { searchRoutes, type RouteSearch, type RouteSearchDeps } from "./search";
import { asTokenAddress } from "./tokenAddress";

import type { Network } from "$lib/models/tokens";

/** The real registry, narrowed to the fields the search reads. */
const REGISTRY = TOKENS as unknown as Registry;

/**
 * The route search, wired to the live aggregators.
 *
 * Everything worth testing lives one layer down: `search.ts` owns the ranking
 * and the rejection rules, `aggregators.ts` owns each chain's swap API, and
 * `fee.ts` owns the bridge's own pricing. This file only chooses between them,
 * so it is small enough to read rather than to test — and untestable under
 * `node --test` for the same reason `registry.ts` is, since it reaches the token
 * registry and through it the wallet modules.
 */

export type FindRoutesOptions = {
  source: Network;
  dest: Network;
  /** Registry id of the token being spent. */
  sourceTokenId: string;
  /** Registry id of the token wanted on arrival. */
  targetTokenId: string;
  /**
   * The source token's address on the source chain: a NEP-141 contract id, or an
   * SPL mint. Needed by the search's own caller, not by the search, which only
   * ever reasons about rails — the source can be any token the user holds,
   * including ones the bridge does not carry.
   */
  sourceTokenAddress: string;
  /** The target token's address on the destination chain. */
  targetTokenAddress: string;
  /**
   * The source token's display symbol, when the caller has already resolved it.
   * The wallet knows native SOL is "SOL"; the search only ever sees its mint.
   */
  sourceSymbol?: string;
  /**
   * The target's symbol, for the same reason as `sourceSymbol`: the receive
   * picker is mostly tokens with no registry key, and their ids shortened into
   * the "what happens" readout.
   */
  targetSymbol?: string;
  /**
   * The target's decimals on the destination chain.
   *
   * The receive picker knows these for every token it lists; the registry knows
   * them only for the tokens the bridge carries. Without them the search fell
   * back to 18, which threw away any route into a low-decimal token — a Solana
   * USDC conversion quotes 122,066,448 units and is then rejected for arriving
   * "less than one whole token" against 10^18.
   */
  targetDecimals?: number;
  /** In the source token's source-chain base units. */
  amount: bigint;
  /** Address on the source chain, for the fee quote. */
  sender: string;
  /** Address on the destination chain, for the fee quote. */
  recipient: string;
  /**
   * The NEAR account that will sign. Required whenever a leg is on NEAR,
   * because the Intear router needs it to include the deposit actions its routes
   * depend on. Optional when both ends stay on Solana.
   */
  nearAccountId?: string;
  /** Restrict the search to one rail, e.g. because the user pinned it. */
  pinnedRailId?: string;
  signal?: AbortSignal;
};

function requireNearAccount(id: string | undefined, chain: Network): string {
  if (!id) {
    throw new Error(
      `Quoting a swap on ${chain} needs the NEAR account that will sign it`,
    );
  }
  return id;
}

/**
 * Build the three dependencies the search asks for.
 *
 * The two swap legs are quoted on *different* aggregators — Jupiter for Solana,
 * the Intear router for NEAR — and each leg spans the token the user named and
 * the rail. Getting either pairing wrong does not throw; it just quietly finds
 * no routes, because each aggregator only understands its own chain's addresses.
 */
export function createRouteSearchDeps({
  source,
  dest,
  sender,
  recipient,
  nearAccountId,
  sourceTokenAddress,
  targetTokenAddress,
  signal,
}: Pick<
  FindRoutesOptions,
  | "source"
  | "dest"
  | "sender"
  | "recipient"
  | "nearAccountId"
  | "sourceTokenAddress"
  | "targetTokenAddress"
  | "signal"
>): RouteSearchDeps {
  const quoteFor = (chain: Network) =>
    chain === "near"
      ? intearQuoter(requireNearAccount(nearAccountId, chain))
      : quoteOnSolana;

  const sourceQuoter = quoteFor(source);
  const destQuoter = quoteFor(dest);
  const sourceToken = asTokenAddress(REGISTRY, sourceTokenAddress, source);
  const targetToken = asTokenAddress(REGISTRY, targetTokenAddress, dest);

  return {
    // The search's signal goes into every quote: a superseded search must drop
    // its queued router calls rather than spend them behind the ones it made
    // obsolete (`SwapQuoter`). Jupiter ignores it, an execution leg never has
    // one, and a fresh search should not wait behind a stale search's retries.
    quoteSourceSwap: (rail, amountIn) =>
      sourceQuoter(sourceToken, rail.sourceAddress, amountIn, signal),
    quoteTargetSwap: (rail, amountIn) =>
      // What the rail's cargo is *held as* on arrival, not the registry's address
      // for it. On NEAR those differ for the wNEAR rail: the payout arrives as
      // native NEAR, so quoting the wrap contract builds a route that begins by
      // unwrapping, and that transaction reverts on an account holding no wNEAR.
      // Quoting it here too means the number the user agreed to is the number a
      // real route gives.
      destQuoter(railAssetOnArrival(rail, dest), targetToken, amountIn, signal),
    quoteBridgeFee: (rail, amount) =>
      getBridgeFee({
        from: source,
        to: dest,
        sender,
        recipient,
        tokenAddress: rail.sourceAddress,
        amount,
      }),
    // A same-chain conversion is one swap on the source chain's own aggregator, so
    // it reuses the source quoter rather than picking a chain: source and dest are
    // the same by definition here.
    quoteSameChainSwap: (amountIn) =>
      sourceQuoter(sourceToken, targetToken, amountIn, signal),
  };
}

/** Search every way to get `amount` of one token to `dest` as another. */
export function findRoutes(options: FindRoutesOptions): Promise<RouteSearch> {
  const {
    source,
    dest,
    sourceTokenId,
    targetTokenId,
    amount,
    pinnedRailId,
    signal,
    sourceSymbol,
    targetSymbol,
    targetDecimals,
    sourceTokenAddress,
    targetTokenAddress,
  } = options;

  return searchRoutes(
    {
      // Imported lazily through the registry binding rather than passed in, so
      // a caller cannot search against a registry the UI is not showing.
      registry: REGISTRY,
      source,
      dest,
      sourceTokenId,
      // The addresses come along too. The search has to tell "this token is the
      // rail, hand it over" from "this token must be swapped into the rail", and a
      // wallet's address and the registry's key disagree even for the same token
      // — `wrap.near` versus `NEAR` — so deciding on the key alone threw away the
      // direct bridge path for every token that has one.
      sourceAddress: sourceTokenAddress,
      targetAddress: targetTokenAddress,
      targetTokenId,
      amount,
      pinnedRailId,
      signal,
      sourceSymbol,
      targetSymbol,
      targetDecimals,
    },
    createRouteSearchDeps(options),
  );
}

/** Everything the Convert tab can deliver on a chain, for the target picker. */
export function deliverableTokens(network: Network): BridgeableToken[] {
  return targetCandidates(network);
}
