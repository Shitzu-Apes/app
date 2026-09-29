import {
  findRail as findRailIn,
  railCandidates as railCandidatesIn,
  targetCandidates as targetCandidatesIn,
  type BridgeableToken,
  type Rail,
  type Registry,
  type TokenId,
} from "./rail";
import { TOKENS } from "./tokens";

import type { Network } from "$lib/models/tokens";

/**
 * The bridge's routing rules, bound to the real token registry.
 *
 * `rail.ts` takes the registry as an argument so its rules can be tested without
 * loading `tokens.ts`, which reaches the wallet modules and cannot be imported
 * outside a SvelteKit build. This file is the whole of that seam: the rules live
 * in one testable place, and the only untested line is the substitution itself.
 */
const REGISTRY = TOKENS as unknown as Registry;

export { TOKENS, REGISTRY };

export function railCandidates(source: Network, dest: Network): Rail[] {
  return railCandidatesIn(REGISTRY, source, dest);
}

export function findRail(
  source: Network,
  dest: Network,
  tokenId: TokenId,
): Rail | undefined {
  return findRailIn(REGISTRY, source, dest, tokenId);
}

export function targetCandidates(network: Network): BridgeableToken[] {
  return targetCandidatesIn(REGISTRY, network);
}

export type { BridgeableToken, Rail } from "./rail";
export type { Registry } from "./rail";
