import type { Network } from "$lib/models/tokens";

/**
 * DexScreener, for token search and for icons.
 *
 * Both of those were being done badly. The Intear indexer has a query endpoint
 * but no icons — it inlines most of them as `data:` URIs, which is megabytes of
 * base64 through a picker — and the Solana list has no way to search at all. So
 * every non-bridge token rendered as a placeholder circle, and searching on Solana
 * could only filter what happened to be loaded.
 *
 * DexScreener carries both: a search that works across chains, and a real image
 * URL per pair. It is keyed on a pool rather than a token, so the same token can
 * appear several times, and its `imageUrl` is whatever the pool's creator set —
 * which is exactly as trustworthy as the token's own metadata, and no worse.
 *
 * Nothing here blocks a token from being offered. A missing icon is cosmetic; a
 * missing token is a broken feature.
 */

const SEARCH = "https://api.dexscreener.com/latest/dex/search";
const TOKEN_PAIRS = "https://api.dexscreener.com/token-pairs/v1";

/** DexScreener's chain slug for a chain this app supports. */
const CHAIN_SLUG: Partial<Record<Network, string>> = {
  near: "near",
  solana: "solana",
};

export type DexPair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  info?: { imageUrl?: string; name?: string };
  baseToken?: {
    address?: string;
    name?: string;
    symbol?: string;
    decimals?: number;
  };
  quoteToken?: { address?: string; symbol?: string };
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  priceUsd?: string;
};

export type DexScreenerHit = {
  tokenId: string;
  symbol: string;
  name?: string;
  decimals: number;
  icon?: string;
  price?: number;
  liquidityUsd?: number;
  volume24hUsd?: number;
};

function toHit(pair: DexPair, chain: string): DexScreenerHit | null {
  // A search matches names and symbols, so most hits are not the chain being
  // asked about. Taking a pair off the wrong chain would offer a token the
  // aggregator cannot be asked about.
  if (chain && pair.chainId !== chain) return null;
  const base = pair.baseToken;
  if (!base?.address) return null;

  return {
    tokenId: base.address,
    symbol: base.symbol ?? base.address,
    name: base.name ?? undefined,
    // A missing decimals field is worse than a guess: 18 is the ERC-20/NEP-141
    // default and the amount is parsed against it.
    decimals: typeof base.decimals === "number" ? base.decimals : 18,
    icon: pair.info?.imageUrl ?? undefined,
    price: pair.priceUsd ? Number(pair.priceUsd) : undefined,
    liquidityUsd: pair.liquidity?.usd,
    volume24hUsd: pair.volume?.h24,
  };
}

async function getJson<T>(
  url: string,
  signal?: AbortSignal,
): Promise<T | null> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // Search and icons are both cosmetic enough that losing them must not empty
    // the picker; the catalogue's own list still stands.
    return null;
  }
}

/** Best hit per token, de-duplicated. DexScreener returns one row per pool. */
/**
 * The best hit per token, deepest pool first.
 *
 * Exported for the icon lookup, which has to make the same choice the search does: a
 * token's artwork is its deepest pool's, and taking whichever pool was listed first is
 * how a venue's logo ended up on a token.
 */
export function bestPerToken(
  pairs: DexPair[],
  chain: string,
): DexScreenerHit[] {
  const byToken = new Map<string, DexScreenerHit>();
  for (const pair of pairs) {
    const hit = toHit(pair, chain);
    if (!hit) continue;
    const existing = byToken.get(hit.tokenId);
    // The deepest pool wins, because that is the one a swap would actually use
    // and the one whose icon and price are worth showing.
    if (!existing || (hit.liquidityUsd ?? 0) > (existing.liquidityUsd ?? 0)) {
      byToken.set(hit.tokenId, hit);
    }
  }
  return [...byToken.values()];
}

/** Search by name, symbol or address. */
export async function searchTokens(
  network: Network,
  query: string,
  signal?: AbortSignal,
): Promise<DexScreenerHit[]> {
  if (query.trim() === "") return [];
  const url = new URL(SEARCH);
  url.searchParams.set("q", query.trim());
  const body = await getJson<{ pairs?: DexPair[] | null }>(
    url.toString(),
    signal,
  );
  if (!body?.pairs) return [];
  return bestPerToken(body.pairs, CHAIN_SLUG[network] ?? "");
}

/**
 * Icons for tokens that are already known, keyed by address.
 *
 * One request per address, batched and concurrency-capped: a wallet holds dozens
 * of tokens and DexScreener rate-limits, so firing every lookup at once earns a
 * burst of 429s and silently degrades the whole list to placeholders. Anything
 * that fails is simply left without an icon.
 *
 * Results are cached for the life of the page. An icon does not change while
 * someone is looking at a token picker, and re-asking on every catalogue rebuild
 * turned one request per token into the same requests again on every chain switch
 * — which is how opening this form came to mean dozens of requests.
 */
const MAX_CONCURRENT = 4;
const iconCache = new Map<string, string | null>();

let inFlight = 0;
const queue: (() => void)[] = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }
  inFlight++;
  try {
    return await fn();
  } finally {
    inFlight--;
    queue.shift()?.();
  }
}

export async function iconsFor(
  network: Network,
  addresses: string[],
  signal?: AbortSignal,
): Promise<Map<string, string>> {
  const slug = CHAIN_SLUG[network];
  const out = new Map<string, string>();
  if (!slug) return out;

  // A null in the cache is a token DexScreener has no artwork for, which is worth
  // remembering as much as a hit: re-asking proves it every single time.
  const wanted = [...new Set(addresses)].filter(
    (address) => address && !iconCache.has(`${slug}:${address}`),
  );
  for (const address of new Set(addresses)) {
    const cached = iconCache.get(`${slug}:${address}`);
    if (cached) out.set(address, cached);
  }

  await Promise.all(
    wanted.map((address) =>
      withSlot(async () => {
        const body = await getJson<DexPair[] | Record<string, never>>(
          `${TOKEN_PAIRS}/${slug}/${address}`,
          signal,
        );
        // A token with no pool answers with `{}` rather than `[]`, and treating
        // that as an array throws — which would take the whole catalogue down for
        // one unknown token.
        const pairs = Array.isArray(body) ? body : [];
        // The *deepest* pair's artwork, not the first pair that has any.
        //
        // The comment here used to claim a liquidity ranking the code did not do: it
        // took the first pair with an image, and a token's pair list is ordered by
        // whatever the venue returns. On NEAR that handed USDC the artwork of the
        // Rhea pool that USDC trades in — a DEX's logo on the token, which is not a
        // near-miss but a confidently wrong answer. `bestPerToken` already ranks by
        // liquidity, so the same ranking is used here.
        // The deepest pool *that has artwork*.
        //
        // Ranking first and then taking whatever the top hit has leaves a token with no
        // icon whenever its deepest pool has none — and `bestPerToken` collapses a
        // token's pools to one hit, so a shallower pool carrying perfectly good artwork
        // is never considered. That is what left USDC and JLU blank on the receive side
        // while the spend side showed them, which is a worse failure than the one this
        // replaced.
        //
        // Ordering by liquidity is still what keeps a venue's logo off a token: the Rhea
        // pool USDC trades in is shallow, so a depth-first walk skips it.
        const icon = [...pairs]
          .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))
          .find((p) => p.info?.imageUrl)?.info?.imageUrl;
        iconCache.set(`${slug}:${address}`, icon ?? null);
        if (icon) out.set(address, icon);
      }),
    ),
  );
  return out;
}
