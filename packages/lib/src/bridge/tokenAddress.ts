import type { Registry } from "./rail";

import type { Network } from "$lib/models/tokens";

/**
 * A token identifier as its on-chain address.
 *
 * An aggregator only understands addresses. A registry *key* reaching one produces a
 * request the router cannot answer — `token_in=JLU&token_out=JLU`, which is a pair of
 * tickers where a pair of contracts belongs, and which reads as a market with no
 * liquidity rather than as the malformed request it is.
 *
 * Resolving here rather than at each caller is deliberate. The search reasons in keys,
 * the pickers hand over addresses, and the two are the same token under different names
 * — so any caller that forgets which it is holding produces this silently, and it has:
 * a same-chain conversion of two bridge assets asked the router for a token against
 * itself. This is the one function that knows both worlds, which makes it the right
 * place to reconcile them.
 *
 * Anything the registry does not carry is already an address, and is passed through
 * unchanged. So is a key whose entry has no address on the network in question, because
 * guessing an address would be worse than sending what we were given.
 */
export function asTokenAddress(
  registry: Registry,
  tokenId: string | null | undefined,
  network: Network,
): string {
  if (!tokenId) return "";
  const entry = registry[tokenId];
  if (!entry) return tokenId;
  const onNetwork = entry.addresses[network];
  if (!onNetwork) return tokenId;
  // The aggregator documents `nep141:` as valid and answers it with an empty route list
  // for every pair, which is indistinguishable from a token with no pool.
  return onNetwork.replace(/^nep141:/, "");
}
