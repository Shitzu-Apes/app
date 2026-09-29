import type { Registry } from "$lib/bridge/rail";
import type { UserTokenHolding } from "$lib/near/ftBalances";
import { normalizeTokenId } from "$lib/near/intear";

/**
 * A NEAR account's NEP-141 balances, in one call where possible.
 *
 * The Solana side discovers holdings by walking the account's token accounts, so
 * it gets everything for free. NEAR has no equivalent walk: an account's holdings
 * are whatever it has explicitly registered for, and the only way to enumerate
 * them is `ft_balances` on the wrapping contract. That is a single view call for
 * every token, against one token call per token otherwise — with a catalogue of
 * over 1,600 NEAR tokens, per-token is not an option.
 *
 * The fallback exists because the bulk call is not universally available. Some
 * RPC providers do not index it, and an account with no NEP-141 registrations
 * returns null rather than an empty object. Rather than show an empty list and let
 * the user conclude they hold nothing, the tokens the app actually cares about are
 * queried individually.
 */

export type NearHolding = {
  /** NEP-141 contract id, or `near` for native NEAR. */
  tokenId: string;
  /** Base units. */
  balance: bigint;
  decimals: number;
  symbol: string;
  icon?: string;
  /** USD price per whole token, when the catalogue has one. */
  price?: number;
  usdValue?: number;
};

export type NearBalancesDeps = {
  /**
   * The indexer's account view: balances, metadata and prices in one request.
   * Primary, and the only source that makes value-ordering possible. Resolves to
   * null to fall back.
   */
  userTokens: (accountId: string) => Promise<UserTokenHolding[] | null>;
  /**
   * FastNear's own index of the account's balances. The first fallback: reliably
   * available, but balances alone, so every token it finds then needs its metadata
   * from somewhere else. Resolves to a map of contract id to base units, or null.
   */
  fastNearBalances: (
    accountId: string,
  ) => Promise<Record<string, string> | null>;
  /**
   * `ft_balances` on the wrapping contract. The last backstop, for when both
   * indexers are unreachable. It is the least reliable of the three: it answers
   * null for an account with no registrations and some providers do not index it
   * at all.
   */
  ftBalances: (accountId: string) => Promise<Record<string, string> | null>;
  /** One token's balance, for the fallback and for native NEAR. */
  balanceOf: (tokenId: string, accountId: string) => Promise<string | null>;
  /** Native NEAR balance in yoctoNEAR, from the account itself rather than a token. */
  nearBalance: (accountId: string) => Promise<string | null>;
  /** Token metadata, for the symbol, decimals and icon. */
  metadata: (tokenId: string) => Promise<{
    symbol?: string;
    decimals?: number;
    icon?: string;
  } | null>;
};

const NATIVE = "near";
const WRAP = "wrap.near";

/**
 * The tokens worth checking individually when the bulk call is unavailable.
 *
 * Bounded on purpose: the bridge's own assets plus native NEAR are the ones a user
 * is most likely to hold and most likely to want to bridge. Asking for all 1,600
 * would be 1,600 view calls.
 */
function fallbackTokens(
  registry: Registry,
): { tokenId: string; decimals: number }[] {
  const out: { tokenId: string; decimals: number }[] = [
    { tokenId: WRAP, decimals: 24 },
  ];
  for (const token of Object.values(registry)) {
    const id = token.addresses.near;
    if (!id) continue;
    out.push({
      tokenId: normalizeTokenId(id),
      decimals: token.decimals.near ?? 18,
    });
  }
  return out;
}

function toHolding(
  tokenId: string,
  balance: bigint,
  meta: { symbol?: string; decimals?: number; icon?: string } | null,
  price: number | undefined,
): NearHolding {
  const decimals = meta?.decimals ?? 24;
  return {
    tokenId,
    balance,
    decimals,
    symbol: meta?.symbol ?? tokenId,
    icon: meta?.icon,
    price,
    usdValue:
      price === undefined
        ? undefined
        : (Number(balance) / 10 ** decimals) * price,
  };
}

/** One price lookup for a set of contract ids, skipping the ones we cannot price. */
export type PriceLookup = (
  ids: string[],
) => Promise<Map<string, number>> | Map<string, number>;

/**
 * Everything a NEAR account holds, best first.
 *
 * Ordered by value when the tokens can be priced and by balance otherwise, so a
 * wallet with one meaningful holding is not buried under a million of a token
 * nobody has a price for.
 */
export async function loadNearHoldings(
  accountId: string,
  registry: Registry,
  deps: NearBalancesDeps,
  prices?: PriceLookup,
): Promise<NearHolding[]> {
  // The indexer's own account view first, because it is the only source that
  // carries balances, metadata and a price together. A price per token is not a
  // nicety: it is what lets the list be ordered by value instead of by raw
  // balance, which is the whole reason a wallet's one meaningful holding is not
  // buried under a million of a worthless token.
  const enriched = await deps.userTokens(accountId).catch(() => null);
  if (enriched !== null) {
    // A zero balance is a registration, not a holding, whichever source reported
    // it. Enforced here rather than only in the fetcher so the invariant holds
    // for every source: a zero-balance row cannot be spent, and offering it is a
    // dead end in the picker.
    return sortHoldings([
      ...enriched.filter((holding) => holding.balance > 0n),
      ...(await nativeNearHolding(deps, accountId, prices)),
    ]);
  }

  const bulk = await deps.fastNearBalances(accountId).catch(() => null);
  // `ft_balances` is still here, and still third, but only as a backstop: it is
  // the enumeration most likely to be unavailable, and it was the reason the NEAR
  // side of the converter could show nothing but native NEAR.
  const rpcBulk =
    bulk === null ? await deps.ftBalances(accountId).catch(() => null) : null;

  const found = new Map<string, bigint>();
  const enumerated = bulk ?? rpcBulk;
  if (enumerated) {
    for (const [tokenId, raw] of Object.entries(enumerated)) {
      try {
        const value = BigInt(raw);
        // A zero balance is a registration, not a holding, and listing it would
        // pad the picker with tokens the user cannot actually send.
        if (value > 0n) found.set(tokenId, value);
      } catch {
        // A malformed entry is skipped rather than failing the whole load.
      }
    }
    // Native NEAR is not a NEP-141 registration, so neither enumeration carries
    // it. Without this the account's own chain would be missing from a list of
    // what the account holds, which is a strange thing to have to explain.
    if (found.size > 0) {
      const native = await deps.nearBalance(accountId).catch(() => null);
      if (native && !found.has(NATIVE)) {
        try {
          if (BigInt(native) > 0n) found.set(NATIVE, BigInt(native));
        } catch {
          // ignore
        }
      }
    }
  } else {
    // The provider cannot enumerate, so ask about the tokens that matter.
    const native = await deps.nearBalance(accountId).catch(() => null);
    if (native) {
      try {
        const value = BigInt(native);
        if (value > 0n) found.set(NATIVE, value);
      } catch {
        // ignore
      }
    }

    const candidates = fallbackTokens(registry);
    const results = await Promise.all(
      candidates.map(async ({ tokenId, decimals }) => {
        const raw = await deps.balanceOf(tokenId, accountId).catch(() => null);
        if (!raw) return null;
        try {
          const value = BigInt(raw);
          // The caller supplies decimals, which may differ from the token's own
          // metadata for the wrapped representation.
          return value > 0n ? { tokenId, value, decimals } : null;
        } catch {
          return null;
        }
      }),
    );
    for (const hit of results) {
      if (hit) found.set(hit.tokenId, hit.value);
    }
  }

  if (found.size === 0) return [];

  const tokenIds = [...found.keys()];
  const [metas, priceMap] = await Promise.all([
    Promise.all(tokenIds.map((id) => deps.metadata(id).catch(() => null))),
    prices?.(tokenIds) ?? Promise.resolve(new Map<string, number>()),
  ]);

  const holdings: NearHolding[] = [];
  tokenIds.forEach((tokenId, index) => {
    const balance = found.get(tokenId)!;
    // Native NEAR is not a token contract and has no metadata; it is 24 decimals
    // by definition and its symbol is fixed.
    if (tokenId === NATIVE) {
      holdings.push(
        toHolding(
          NATIVE,
          balance,
          { symbol: "NEAR", decimals: 24 },
          priceMap.get(tokenId),
        ),
      );
      return;
    }
    // A token the registry knows has verified decimals, which beats whatever its
    // own metadata claims when the two disagree — the bridge moves it.
    const registered = Object.values(registry).find((token) => {
      const id = token.addresses.near;
      return id && normalizeTokenId(id) === tokenId;
    });
    const meta = metas[index];
    holdings.push({
      ...toHolding(tokenId, balance, meta, priceMap.get(tokenId)),
      decimals: registered?.decimals.near ?? meta?.decimals ?? 24,
      symbol: registered?.symbol ?? meta?.symbol ?? tokenId,
      icon: registered?.icon || meta?.icon,
    });
  });

  return sortHoldings(holdings);
}

/**
 * Native NEAR as a holding, or nothing.
 *
 * No enumeration carries it, because it is not a NEP-141 registration: FastNear
 * indexes token contracts and `ft_balances` indexes registrations. The account's
 * own chain missing from a list of what the account holds is a strange thing to
 * have to explain.
 */
async function nativeNearHolding(
  deps: NearBalancesDeps,
  accountId: string,
  prices?: PriceLookup,
): Promise<NearHolding[]> {
  const raw = await deps.nearBalance(accountId).catch(() => null);
  if (!raw) return [];
  try {
    if (BigInt(raw) <= 0n) return [];
  } catch {
    return [];
  }
  const price = prices
    ? (await Promise.resolve(prices([NATIVE]))).get(NATIVE)
    : undefined;
  return [
    toHolding(NATIVE, BigInt(raw), { symbol: "NEAR", decimals: 24 }, price),
  ];
}

/**
 * Best holding first: by value where a price is known, then by raw balance.
 *
 * A token that can be priced always outranks one that cannot, because a priced
 * token is a token whose worth is known — otherwise the ordering is just the
 * decimals of the contract, which is not a ranking of anything.
 */
function sortHoldings(holdings: NearHolding[]): NearHolding[] {
  return holdings.sort((a, b) => {
    const av = a.usdValue;
    const bv = b.usdValue;
    if (av !== undefined && bv !== undefined && av !== bv) return bv - av;
    if (av !== undefined) return -1;
    if (bv !== undefined) return 1;
    return b.balance > a.balance ? 1 : -1;
  });
}
