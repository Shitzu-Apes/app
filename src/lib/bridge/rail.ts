import type { Network } from "$lib/models/tokens";
import { normalizeTokenId } from "$lib/near/intear";

/**
 * The shape `rail.ts` needs from the token registry.
 *
 * It takes the registry as an argument rather than importing `TOKENS`, and that
 * is not a stylistic preference. `tokens.ts` also owns every balance store and
 * reaches the wallet modules, which read `import.meta.env` at module scope and
 * cannot be imported outside a SvelteKit build — so a module that imports the
 * registry cannot be unit tested at all. Keeping the dependency on the *shape*
 * means the routing rules here are testable against the real data, and
 * `registry.ts` is the one line that binds the two together.
 */
export type RegistryEntry = {
  symbol: string;
  icon: string;
  decimals: Record<Network, number | undefined>;
  addresses: Record<Network, string | undefined>;
};

export type Registry = Record<string, RegistryEntry>;

export type TokenId = string;

/** Fallback when an entry omits decimals for a network it is listed on. */
function decimalsOf(entry: RegistryEntry, network: Network): number {
  return entry.decimals[network] ?? 18;
}

/**
 * A registry token as it exists on one network.
 *
 * The NEAR address is normalised to the form the aggregator accepts. The
 * `nep141:` prefix is documented as valid and answered with an empty route list
 * for every pair, which is indistinguishable from a token with no pool, so a
 * caller that forgot to strip it would see a dead market rather than a bug.
 */
export type BridgeableToken = {
  tokenId: TokenId;
  symbol: string;
  icon: string;
  address: string;
  decimals: number;
};

/**
 * The chains the Convert form can move between.
 *
 * EVM is absent on purpose: none of the EVM chains has liquidity in a token this
 * bridge can deliver to NEAR, so a conversion to or from one could be priced but
 * never completed. The native Bridge tab still reaches them, and this list is not
 * a claim about what the bridge supports — only about what a conversion can
 * actually finish.
 */
export const CONVERT_CHAINS = ["near", "solana"] as const;

/**
 * May the two ends be the same chain?
 *
 * They may, and that is a real mode rather than a degenerate one: it is a plain
 * swap with no bridge in it. It is also the only way to reach a token that exists
 * on just one chain — OMGY has no Solana liquidity at all, so buying it with USDC
 * while already on NEAR is a same-chain conversion, and refusing to offer it
 * would mean a token users can see on the target list has no route at all.
 */
export const ALLOW_SAME_CHAIN = true;

export type ConvertChain = (typeof CONVERT_CHAINS)[number];

/**
 * The bridge tokens known to have liquidity on Solana, and the only ones a swap on
 * that chain may be routed *through*.
 *
 * A bridge route is only as good as the swap at each end, and the two ends are not
 * symmetric. On NEAR every token is assumed to have a pool, because the router there
 * enumerates them and the absence of a route is itself the answer. On Solana there is
 * no such enumeration: most of what the registry carries has no pool against
 * anything, and the only symptom is a swap leg that cannot be quoted.
 *
 * So the Solana side is a closed list of **rails**, and this is the distinction the
 * whole rule turns on. The restricted thing is the token in the *middle* — the one
 * being swapped into and out of — not the token at either end. Restricting the ends
 * instead is wrong twice over: it forbids USDC → USDC, which is the deepest pair on
 * Solana and the conversion most likely to be wanted, and it does so only after
 * asking the router about every rail in the registry.
 *
 * A straight bridge is untouched, because it needs no pool anywhere.
 *
 * `NEAR` is the registry's key for wrapped NEAR, which is what every NEAR rail arrives
 * as on Solana and therefore the natural middle of nearly every swap on that side.
 * `SHITZU` and `JAMBO` are the other pools known to be there.
 *
 * This is a list of what is *known*, not a claim that the rest has no liquidity — a
 * token is added here the moment a pool for it is confirmed. That is why it is not
 * derived from the registry: the registry is what the bridge carries, which is a
 * different question from what can be traded.
 */
export const SOLANA_LIQUIDITY: ReadonlySet<TokenId> = new Set([
  "NEAR",
  "SHITZU",
  "JAMBO",
]);

/**
 * May a swap on Solana be routed through this token?
 *
 * A registry key and an address are both accepted, for the same reason everywhere
 * else in this module accepts both: a wallet knows a token by its mint and the
 * registry by its key, and the two disagree even for the same token. Comparing only
 * the key would reject wNEAR whenever the caller held it by mint — which is what a
 * Solana wallet always does.
 */
export function canSwapOnSolana(
  registry: Registry,
  tokenId: string,
  address: string | undefined,
  liquidity: ReadonlySet<TokenId> = SOLANA_LIQUIDITY,
): boolean {
  // Both fields, and either may hold the key *or* the mint. A caller that knows a
  // token only by its mint puts it in the id and leaves the address unset, so
  // checking the address alone would reject wNEAR and reject SHITZU for the whole of
  // Solana's side of the bridge.
  const known = [tokenId, address].filter(
    (value): value is string => value !== undefined && value !== "",
  );
  for (const key of liquidity) {
    const mint = registry[key]?.addresses?.solana;
    if (!mint) continue;
    if (known.includes(key) || known.includes(mint)) return true;
  }
  return false;
}

/**
 * A token the Omni Bridge can carry between two specific networks.
 *
 * The bridge moves one registered token per transfer and has no notion of a
 * route, so "get my USDC to Solana as SHITZU" is not one bridge operation. It is
 * a choice of *which* token to hand the bridge, and that choice is worth real
 * money: routing USDC through wNEAR and swapping to SHITZU on Solana fails
 * outright, because Jupiter reports SHITZU as not tradable there, while swapping
 * to SHITZU on NEAR first and bridging SHITZU needs no second swap at all. So
 * the rail is searched over rather than fixed.
 *
 * A rail needs an address on *both* ends. That is what excludes XAUT, which
 * exists on NEAR and Ethereum but on neither Solana nor the other EVM chains.
 */
export type Rail = {
  tokenId: TokenId;
  symbol: string;
  icon: string;
  /** NEP-141 contract id, or SPL mint, on the source network. */
  sourceAddress: string;
  /** The same token on the destination network. */
  destAddress: string;
  sourceDecimals: number;
  destDecimals: number;
};

function onNetwork(
  tokenId: TokenId,
  entry: RegistryEntry,
  network: Network,
): BridgeableToken | undefined {
  const raw = entry.addresses[network];
  if (!raw) return undefined;
  return {
    tokenId,
    symbol: entry.symbol,
    icon: entry.icon,
    address: network === "near" ? normalizeTokenId(raw) : raw,
    decimals: decimalsOf(entry, network),
  };
}

/**
 * The token a rail's cargo is *held as* on a chain, for quoting a swap there.
 *
 * The bridge is not symmetric, and the difference matters to a swap that runs after
 * it lands. Sending wNEAR out of NEAR takes the wrapped contract — that is the
 * thing the locker holds. Receiving it on NEAR delivers **native** NEAR: the payout
 * unwraps, so the account ends up holding `near`, not `wrap.near`.
 *
 * Quoting the destination swap with the wrap contract therefore asks the router to
 * do the unwrap itself, and it builds a route that starts with `near_withdraw`:
 *
 *     token_in=wrap.near  ->  ft_transfer_call, near_withdraw, deposit_near
 *     token_in=near       ->  near_deposit, ft_transfer_call, deposit_near
 *
 * The first reverts, because the account has nothing wrapped to withdraw. That is a
 * real failed transaction on a bridge that worked perfectly, and it cost a signature
 * to discover.
 *
 * So the asset on the *receiving* side of a NEAR rail is native NEAR, while the
 * asset on the sending side is the wrapped contract. Only the destination is
 * affected, which is why this is about arriving and not about bridging.
 *
 * Every other rail arrives as its own NEP-141. This function used to return `near`
 * for any rail on the NEAR side, which made a SHITZU bridge look like it paid out
 * native NEAR — and the destination swap that followed then ran against whatever
 * NEAR the account happened to hold rather than the SHITZU the bridge had just
 * delivered.
 */
export function railAssetOnArrival(
  rail: Pick<Rail, "tokenId" | "sourceAddress" | "destAddress">,
  network: Network,
): string {
  // The Solana side is genuinely wNEAR as an SPL mint, so it needs no translation.
  if (network !== "near") return rail.destAddress;
  // Only the wrapped-NEAR rail unwraps on payout. The registry key is the honest
  // test for it: the address is `wrap.near` on mainnet and `wrap.testnet` on
  // testnet, and hardcoding either one would be wrong on the other.
  return rail.tokenId === "NEAR" ? "near" : rail.destAddress;
}

/**
 * Every token that can be the bridge's cargo between these two networks.
 *
 * Ordered by the registry's own order, which puts NEAR first. That is not
 * cosmetic: wNEAR has the deepest pool on both chains, so it is the fallback
 * that still works when a memecoin rail has no liquidity, and the search leans
 * on this order to break ties deterministically. A registry that reorders
 * itself between renders would make the UI reshuffle for no reason.
 */
export function railCandidates(
  registry: Registry,
  source: Network,
  dest: Network,
): Rail[] {
  if (source === dest) return [];

  const rails: Rail[] = [];
  for (const [tokenId, entry] of Object.entries(registry)) {
    const onSource = onNetwork(tokenId, entry, source);
    const onDest = onNetwork(tokenId, entry, dest);
    if (!onSource || !onDest) continue;
    rails.push({
      tokenId,
      symbol: entry.symbol,
      icon: entry.icon,
      sourceAddress: onSource.address,
      destAddress: onDest.address,
      sourceDecimals: onSource.decimals,
      destDecimals: onDest.decimals,
    });
  }
  return rails;
}

/** The rail for one specific token, or undefined when it cannot be carried. */
export function findRail(
  registry: Registry,
  source: Network,
  dest: Network,
  tokenId: TokenId,
): Rail | undefined {
  return railCandidates(registry, source, dest).find(
    (r) => r.tokenId === tokenId,
  );
}

/**
 * Everything that can be delivered on `network`, for the target picker.
 *
 * A token is listed whether or not it can currently be swapped into, because
 * that is only knowable for a specific amount. Refusing to offer it up front
 * would hide a route that works at the size the user is actually bridging, and
 * would make the list flicker as prices moved. The search quotes the chosen
 * target at the real amount instead.
 */
export function targetCandidates(
  registry: Registry,
  network: Network,
): BridgeableToken[] {
  return Object.entries(registry)
    .map(([tokenId, entry]) => onNetwork(tokenId, entry, network))
    .filter((token): token is BridgeableToken => token !== undefined);
}
