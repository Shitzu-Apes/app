import { CHAINS } from "./chains";
import { searchTokens } from "./dexscreener";
import { isDust } from "./dust";
import type { BridgeableToken, Registry } from "./rail";

import type { Network } from "$lib/models/tokens";

/**
 * Everything that can be received on a chain, not just what the bridge carries.
 *
 * The bridge's own registry is the reliable core — those tokens provably arrive,
 * because the bridge is what carries them — but it is eight tokens, and a target
 * picker offering only those makes the feature look like a renamed native bridge.
 * The rest comes from the two aggregators' own token lists, which is where every
 * swappable token already is.
 *
 * Which list is consulted depends on the chain, because each aggregator only
 * indexes its own: Intear for NEAR, Jupiter for Solana. Both are merged with the
 * registry and de-duplicated on the address, since a bridged token appears in both
 * — with the registry's copy winning, because its icon and decimals are the ones
 * the app has verified against the bridge.
 */

export type CatalogToken = BridgeableToken & {
  /**
   * Identity is the *address*, not the app's registry key.
   *
   * The two are different things and conflating them breaks in both directions: a
   * bridged token is `SHITZU` in the app's registry but `token.0xshitzu.near` on
   * the chain and `AFbJW5…` on Solana, and only the address is what gets quoted
   * and sent. Using the registry key would collide the moment a token appeared in
   * both sources, and would name a Solana token by a NEAR contract.
   */
  tokenId: string;
  /**
   * The app's registry key, when this token is one the bridge carries. That is
   * what makes it eligible to be a *rail*, so it is needed even though it is not
   * how the token is addressed.
   */
  bridgeTokenId?: string;
  /** USD price per whole token, when the source provided one. */
  price?: number;
  /**
   * True when the token is in the bridge's own registry, i.e. it can also be
   * carried rather than only swapped. Worth distinguishing in the picker: these
   * are the tokens a conversion can route *through*.
   */
  bridgeable: boolean;
  /** Held by the connected account, for the "Yours" section. */
  held?: bigint;
  /** Value of the holding, the only ordering that means anything across tokens. */
  heldUsd?: number;
  /** Where the token was found, for the section heading. */
  origin: "bridge" | "aggregator";
};

/**
 * The NEAR indexer's browsable list, deliberately the curated one.
 *
 * This was `tokens-unknown-or-better` — 1,681 tokens, a 4.6 MB response — on the
 * reasoning that a memecoin is `Unknown` until it has a track record, so
 * reputation-filtering the browsable list would hide what people actually hold.
 * That reasoning was about *search*, and it was applied to the list, which is a
 * different question. The list is what someone scrolls before typing anything, and
 * 1,681 entries of mostly-illiquid memecoins is not a picker, it is a database.
 *
 * `tokens-notfake-or-better` is 77 tokens in 295 KB — the same 2% of the market
 * carrying the reputation. Reputation filtering now happens in the *search*, where
 * the user has typed something and wants a narrow answer, and anything the
 * account holds is added regardless of reputation, so tightening the list cannot
 * hide a token from its own owner.
 */
const INTEAR_TOKENS = "https://prices.intear.tech/tokens-notfake-or-better";
const INTEAR_SEARCH = "https://prices.intear.tech/token-search";
const INTEAR_PRICES = "https://prices.intear.tech/prices";
/** NEAR's wrapping contract, which wraps the same tokens as the native account. */
const WRAP_NEAR_ADDRESS = "wrap.near";

const JUPITER_TAGS = "https://lite-api.jup.ag/tokens/v2/tag";
const JUPITER_PRICE = "https://lite-api.jup.ag/price/v3";

type IntearToken = {
  account_id: string;
  metadata?: {
    symbol?: string;
    name?: string;
    decimals?: number;
    /** The indexer carries icons, which saves a request per token. */
    icon?: string;
  };
  price_usd?: string;
  liquidity_usd?: number;
  volume_usd_24h?: number;
  reputation?: string;
  /** A token the indexer has flagged as withdrawn. */
  deleted?: boolean;
};

type JupiterToken = {
  id: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  icon?: string;
  priceUsd?: number;
  liquidity?: number;
  organicScore?: number;
  isVerified?: boolean;
};

type JupiterPrice = { usdPrice?: number } | undefined;

/**
 * USD prices for a set of mints, batched.
 *
 * The tag list that populates the picker carries no prices, so without this every
 * Solana row would show a blank price and — worse — the "sort by what you hold"
 * ordering would have nothing to sort on, which is the ordering that makes a
 * wallet with one meaningful balance usable.
 *
 * Only the tokens that need a price are requested: the ones held and the bridge's
 * own. Pricing all 3,700 would be a hundred requests for figures nobody reads.
 */
async function priceSolana(
  mints: string[],
  signal?: AbortSignal,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const wanted = [...new Set(mints)].filter(Boolean);
  if (wanted.length === 0) return out;

  const BATCH = 40;
  for (let i = 0; i < wanted.length; i += BATCH) {
    const batch = wanted.slice(i, i + BATCH);
    const body = await getJson<Record<string, JupiterPrice>>(
      `${JUPITER_PRICE}?ids=${batch.join(",")}`,
      signal,
    );
    if (!body) continue;
    for (const mint of batch) {
      const price = body[mint]?.usdPrice;
      if (typeof price === "number") out.set(mint, price);
    }
  }
  return out;
}

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  // The Intear indexer returns prices as fixed-point strings with 200+ decimal
  // places, so they have to be parsed rather than coerced.
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
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
    // A failed list is a missing section, not a broken form: the bridge assets
    // are known locally and always render.
    return null;
  }
}

/**
 * The bridge's own tokens, which always arrive.
 *
 * The registry arrives as an argument for the same reason `rail.ts` takes one:
 * `tokens.ts` also owns the balance stores and reaches the wallet modules, so a
 * module that imports it cannot be loaded outside a SvelteKit build — and a
 * catalogue nobody can test is a catalogue nobody will fix.
 */
function bridgeAssets(registry: Registry, network: Network): CatalogToken[] {
  return Object.entries(registry)
    .filter(([, token]) => token.addresses[network] !== undefined)
    .map(([tokenId, token]) => {
      const address =
        network === "near"
          ? token.addresses[network]!.replace(/^nep141:/, "")
          : token.addresses[network]!;
      return {
        // The address is the identity; the registry key is kept alongside it
        // because that is what marks the token as a possible rail.
        tokenId: address,
        bridgeTokenId: tokenId,
        symbol: token.symbol,
        icon: token.icon,
        address,
        decimals: token.decimals[network] ?? 18,
        bridgeable: true,
        origin: "bridge" as const,
      };
    });
}

/**
 * A NEP-141 contract id the router can actually be asked about.
 *
 * The indexer lists bridged tokens under their 64-hex address form, which is not
 * a NEAR account id. The aggregator addresses tokens by contract id, so those
 * entries would quote as "no route" for every amount — indistinguishable from a
 * token with no pool. They are dropped rather than shown, and a token whose only
 * listing is in that form is not reachable from here.
 */
function isQuotableNearId(accountId: string): boolean {
  return accountId.endsWith(".near") && !accountId.startsWith("nep141:");
}

function intearToCatalog(
  token: IntearToken,
): CatalogToken & { __liquidity: number } {
  return {
    tokenId: token.account_id,
    symbol: token.metadata?.symbol ?? token.account_id,
    // The indexer's icon, inlined or not, is the token's own artwork and is
    // carried through. Dropping the `data:` ones was a call made against a
    // 1,681-token list, where they were a few megabytes of base64; the list is 77
    // now, which is a rounding error against the 295 KB already being downloaded.
    // It also made the picker quietly worse rather than merely plainer: a token
    // with no DexScreener pool has no other icon to fall back to, so discarding
    // this left it as a grey circle forever.
    icon: token.metadata?.icon ?? "",
    address: token.account_id,
    // The indexer omits decimals for a token with no metadata; 18 is the NEP-141
    // default and a wrong-but-plausible value would misprice the amount.
    decimals: token.metadata?.decimals ?? 18,
    price: num(token.price_usd),
    bridgeable: false,
    origin: "aggregator" as const,
    __liquidity: num(token.liquidity_usd) ?? 0,
  };
}

/** NEAR tokens the aggregator can swap, ranked by the liquidity behind them. */
export async function nearCatalog(
  signal?: AbortSignal,
): Promise<CatalogToken[]> {
  const raw = await getJson<IntearToken[]>(INTEAR_TOKENS, signal);
  if (!raw) return [];

  return raw
    .filter((token) => token.account_id && !token.deleted)
    .filter((token) => isQuotableNearId(token.account_id))
    .map(intearToCatalog)
    .sort((a, b) => b.__liquidity - a.__liquidity)
    .map(({ __liquidity: _ignored, ...token }) => token);
}

/**
 * The verified tag list, fetched once for the life of the page.
 *
 * It is 3,703 tokens and about 5 MB, and it used to be fetched on every call. That was
 * survivable while a catalogue was built once per chain switch; it stopped being
 * survivable when the rebuild also started firing on new balances, because a page load
 * where both wallets connect asks for it twice and a wallet that reloads asks again on
 * every balance change.
 *
 * The in-flight promise is cached rather than the parsed result, so two callers that
 * arrive together share one download instead of racing two. An aborted caller does not
 * poison the cache for everyone else: the shared request carries no signal, because a
 * request that dies with the first caller to leave would leave the second with nothing.
 */
let verifiedTagList: Promise<JupiterToken[] | null> | null = null;

function fetchVerifiedTagList(): Promise<JupiterToken[] | null> {
  if (verifiedTagList) return verifiedTagList;
  const request = getJson<JupiterToken[]>(`${JUPITER_TAGS}?query=verified`);
  verifiedTagList = request;
  void request.then((list) => {
    // A failure is not cached. `getJson` answers a dead request with null rather than
    // throwing, so a transient blip held here would leave the picker permanently
    // without its Solana section, for the rest of the session and across every reload
    // of the list that a balance change triggers.
    if (!list && verifiedTagList === request) verifiedTagList = null;
  });
  return request;
}

/**
 * Forget the cached tag list.
 *
 * A test seam, and the reason a stale list cannot outlive a reload — the same reason
 * `clearRoutedPairs` exists in `aggregators.ts`. It is also how a failed download is
 * retried: the cache drops itself when the fetch comes back empty, so this is only
 * needed by a test that wants a cold cache.
 */
export function clearVerifiedTagList(): void {
  verifiedTagList = null;
}

/** Solana tokens the aggregator can swap, ranked by organic score. */
export async function solanaCatalog(): Promise<CatalogToken[]> {
  // No signal, deliberately. The list is shared by every caller for the life of the
  // page, so it belongs to the page rather than to one caller, and a caller that
  // navigates away must not take the download away from whoever is still reading.
  const raw = await fetchVerifiedTagList();
  if (!raw) return [];

  return raw
    .filter((token) => token.id)
    .map((token) => ({
      tokenId: token.id,
      symbol: token.symbol ?? token.id,
      icon: token.icon ?? "",
      address: token.id,
      decimals: token.decimals ?? 0,
      price: num(token.priceUsd),
      bridgeable: false,
      origin: "aggregator" as const,
      ...({ __score: num(token.organicScore) ?? 0 } as object),
    }))
    .sort(
      (a, b) =>
        ((b as { __score?: number }).__score ?? 0) -
        ((a as { __score?: number }).__score ?? 0),
    );
}

/**
 * Does this query name one NEAR account, rather than describe a search?
 *
 * Used to decide one thing: whether the reputation filter applies. `NotFake` keeps a
 * wall of spam out of a picker someone is scrolling, and a contract id is not a
 * scroll — the user has already named the token, so reputation-filtering it can only
 * hide the answer. `dragon-3.nearlytrade.near` is `Unknown` and asking for it came
 * back empty until the filter was dropped, which is also why its icon was missing:
 * the indexer has the artwork, and the picker never saw the record.
 */
function looksLikeAccountId(query: string): boolean {
  const trimmed = query.trim();
  return (
    !/\s/.test(trimmed) && /^[a-z0-9][a-z0-9._-]*\.[a-z0-9_-]+$/i.test(trimmed)
  );
}

/** Type-ahead over the NEAR indexer, which is a query API rather than a list. */
export async function searchNear(
  query: string,
  accountId?: string,
  signal?: AbortSignal,
): Promise<CatalogToken[]> {
  if (query.trim() === "") return [];
  const url = new URL(INTEAR_SEARCH);
  url.searchParams.set("q", query.trim());
  url.searchParams.set("n", "20");
  // `NotFake` keeps a wall of spam out of a picker the user is scrolling, and
  // the account boosts what they already hold. A contract id is not a scroll — see
  // `looksLikeAccountId`.
  if (!looksLikeAccountId(query)) url.searchParams.set("rep", "NotFake");
  if (accountId) url.searchParams.set("acc", accountId);

  const raw = await getJson<IntearToken[]>(url.toString(), signal);
  if (!raw) return [];

  return raw
    .filter((token) => token.account_id)
    .map((token) => ({
      tokenId: token.account_id,
      symbol: token.metadata?.symbol ?? token.account_id,
      // The indexer's icon, carried the way the browsable list already carries it
      // (see `intearToCatalog`). Dropping it left every NEAR search row to
      // DexScreener, which has no image for most of this chain: three `dragon` hits
      // with a few kilobytes of inlined artwork each were rendering as grey circles.
      icon: token.metadata?.icon ?? "",
      address: token.account_id,
      decimals: token.metadata?.decimals ?? 18,
      price: num(token.price_usd),
      bridgeable: false,
      origin: "aggregator" as const,
    }));
}

/**
 * The market's prices, keyed by contract id.
 *
 * 3,605 ids in about 130 KB — less than the curated browse list, and enough to price
 * every token a wallet can hold in one request. Cached for the life of the page,
 * because a single holdings load asks twice: once for the tokens, and again for
 * native NEAR, which has no contract of its own to be listed under.
 *
 * A failure is not cached, for the same reason the Solana tag list is not: a blip
 * held here would leave every balance unpriced for the rest of the session.
 */
let priceList: Promise<Record<string, number> | null> | null = null;

function fetchPriceList(): Promise<Record<string, number> | null> {
  if (priceList) return priceList;
  const request = getJson<Record<string, number>>(INTEAR_PRICES);
  priceList = request;
  void request.then((prices) => {
    if (!prices && priceList === request) priceList = null;
  });
  return request;
}

/** Forget the cached prices. A test seam, as `clearVerifiedTagList` is. */
export function clearNearPrices(): void {
  priceList = null;
}

/**
 * USD prices for a set of NEAR contract ids.
 *
 * This used to be a `token-search` with the ids space-joined, on the belief that the
 * endpoint took several. It does not — the query is one substring match, so a list of
 * ids matched nothing and every holding fell back to being ordered by raw balance,
 * with no dollar value at all. `/prices` is the endpoint that answers this question.
 *
 * `near` is priced as `wrap.near`, the contract that wraps it one for one: native NEAR
 * has no contract to be listed under, and the app treats the two as one asset
 * everywhere else (see the native row in `buildCatalog`).
 */
export async function pricesNear(ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const prices = await fetchPriceList();
  if (!prices) return out;
  for (const id of new Set(ids)) {
    const price = id === "near" ? prices[WRAP_NEAR_ADDRESS] : prices[id];
    // A zero is the indexer's answer for a token with no market, and a confident
    // "$0.00" is what `usdFor` exists to avoid — so it is left out, not carried.
    if (typeof price === "number" && price > 0) out.set(id, price);
  }
  return out;
}

/** Type-ahead over Jupiter's token list. */
export async function searchSolana(
  query: string,
  signal?: AbortSignal,
): Promise<CatalogToken[]> {
  if (query.trim() === "") return [];
  const raw = await getJson<JupiterToken[]>(
    `https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(query.trim())}`,
    signal,
  );
  if (!raw) return [];

  return raw
    .filter((token) => token.id)
    .map((token) => ({
      tokenId: token.id,
      symbol: token.symbol ?? token.id,
      icon: token.icon ?? "",
      address: token.id,
      decimals: token.decimals ?? 0,
      price: num(token.priceUsd),
      bridgeable: false,
      origin: "aggregator" as const,
    }));
}

/**
 * The registry copy wins a collision.
 *
 * A bridged token is in both lists, and the aggregator's entry is the one with a
 * live price but the wrong icon — Jupiter calls the wrapped NEAR token "wNEAR"
 * and has no image for it, whereas the app ships both deliberately.
 */
function merge(...lists: CatalogToken[][]): CatalogToken[] {
  const byAddress = new Map<string, CatalogToken>();
  for (const list of lists) {
    for (const token of list) {
      const existing = byAddress.get(token.address);
      if (!existing) {
        byAddress.set(token.address, token);
        continue;
      }
      byAddress.set(token.address, {
        ...token,
        // The registry's identity and artwork win; the aggregator's price and
        // liquidity are worth keeping. The registry key is what marks the token
        // as a possible rail, so it survives the collision.
        bridgeTokenId: existing.bridgeTokenId,
        symbol: existing.symbol,
        icon: existing.icon || token.icon,
        decimals: existing.decimals,
        bridgeable: existing.bridgeable || token.bridgeable,
        origin: existing.origin,
        price: token.price ?? existing.price,
      });
    }
  }
  return [...byAddress.values()];
}

/**
 * Everything deliverable on a chain, best first.
 *
 * Held tokens sort above everything else by value, then the bridge's own assets,
 * then the rest by whatever liquidity the source reported. Sorting by value first
 * is what makes a wallet with one meaningful balance usable: ordering by token
 * count buries it under a million of a worthless token.
 */
export async function buildCatalog(
  registry: Registry,
  network: Network,
  held: {
    address: string;
    balance: bigint;
    /** The wallet has already resolved these, so there is no reason to guess. */
    symbol?: string;
    decimals?: number;
    /** What the balance is worth, when anything knows. Decides dust. */
    usdValue?: number;
    /** Artwork the spend list has already resolved for this token. */
    icon?: string;
  }[] = [],
  signal?: AbortSignal,
): Promise<CatalogToken[]> {
  const aggregator =
    network === "near" ? await nearCatalog(signal) : await solanaCatalog();

  const heldByAddress = new Map(held.map((h) => [h.address, h.balance]));
  const bridge = bridgeAssets(registry, network);
  // A token the account holds is always offered, whatever any list says about it.
  // The curated NEAR list is 77 tokens, and the whole point of a tighter list is
  // that most of the market is noise — but noise the user happens to own is not
  // noise, it is the token they are most likely to want to receive more of.
  // Merging these in is also what lets the list be tight at all: without it,
  // tightening it would quietly delete tokens from their owner's picker.
  // Dust does not count as held. A wallet holds hundreds of airdropped shards it has
  // never spent, and treating every one of them as "held" floats them to the top of the
  // receive list and buries the balances worth acting on. Unpriced balances are kept:
  // not being able to value a token is not being worthless.
  // Native NEAR's artwork is the chain's, and it is not something to look up: asking
  // an indexer for it is a request whose answer is either the same image or a pool's.
  const nativeIcon = CHAINS[network].icon;
  const heldOnly: CatalogToken[] = held
    .filter(
      (h) =>
        h.balance > 0n &&
        h.decimals !== undefined &&
        !isDust({
          balance: h.balance,
          usdValue: h.usdValue,
          decimals: h.decimals,
        }),
    )
    .map((h) => ({
      tokenId: h.address,
      symbol: h.symbol ?? h.address,
      // The artwork the spend list already resolved, so the two ends cannot disagree
      // about the same token. Asking an indexer again for something already in hand is
      // how the receive side ended up blank for tokens the spend side showed perfectly
      // well — the request either failed or was still in flight, and the row rendered a
      // placeholder in the meantime.
      //
      // Native NEAR's artwork is the chain's either way: asking an indexer for it
      // returns the same image or a pool's.
      icon: h.address === "near" ? nativeIcon : (h.icon ?? ""),
      address: h.address,
      decimals: h.decimals as number,
      bridgeable: false,
      origin: "aggregator" as const,
      // The wallet's own valuation of it, which on NEAR is the only one there is: the
      // curated list carries no price for a token it has not heard of, so without this
      // every held token sorted as worth nothing and lost its row.
      heldUsd: h.usdValue,
    }));
  let merged = merge(bridge, aggregator, heldOnly);

  // One row for native NEAR, not two.
  //
  // The same balance reaches the holdings under `near` and again as `wrap.near`, and
  // the registry also carries wNEAR as a bridgeable asset — so the receive list showed
  // "NEAR" twice, once plain and once marked bridgeable. They are one asset, the
  // product calls both of them NEAR, and the second row is the wrapped form rather than
  // the native balance that can actually be spent. When the native row is present it
  // wins, because that is the one holding the spendable balance.
  if (merged.some((t) => t.address === "near")) {
    merged = merged.filter((t) => t.address !== WRAP_NEAR_ADDRESS);
  }

  // On Solana the list that populates the picker carries no prices, so the ones
  // that matter are priced directly: what is held, what the bridge carries, and
  // the head of the list the user actually scrolls. Pricing all 3,700 would be a
  // hundred requests, and pricing nothing would leave every visible price blank.
  const priced =
    network === "solana"
      ? await priceSolana(
          [
            ...held.map((h) => h.address),
            ...bridge.map((t) => t.address),
            ...merged.slice(0, 80).map((t) => t.address),
          ],
          signal,
        )
      : new Map<string, number>();

  // Icons are not fetched here. They used to be, for the first 60 tokens, which
  // made opening this form cost 60 requests before the list had been read — and
  // the same 60 again on every chain switch, because nothing was cached. The list
  // picker asks for the icons of what it is actually showing, once, and the lookup
  // caches for the life of the page, so the two stay in step however many rows that
  // is: the list renders a bounded number and the icons follow the render.
  const icons = new Map<string, string>();

  const withPrices = merged.map((token) => {
    const price = token.price ?? priced.get(token.address);
    const balance = heldByAddress.get(token.address);
    const icon = icons.get(token.address) ?? token.icon;
    if (price === undefined && balance === undefined && icon === token.icon) {
      return token;
    }
    return {
      ...token,
      icon,
      price,
      held: balance,
      // The catalogue's own price where it has one, and the wallet's valuation
      // otherwise. Falling back to the token's `price` alone left every held NEAR
      // token unvalued, which put the bridge's own assets — which *are* in the curated
      // list, and so do have a price — above a balance of the user's own.
      heldUsd:
        balance === undefined
          ? undefined
          : ((price === undefined
              ? token.heldUsd
              : (Number(balance) / 10 ** token.decimals) * price) ?? undefined),
    };
  });

  return withPrices.sort((a, b) => {
    // Native leads, on both ends of the form and for the same reason: it is the one
    // asset the account certainly has, and on the receiving side it is what the bridge
    // actually delivers. Letting a large holding push it down makes the token the
    // conversion is *about* the hardest one to pick.
    const aNative = a.tokenId === "near" || a.address === "near";
    const bNative = b.tokenId === "near" || b.address === "near";
    if (aNative !== bNative) return aNative ? -1 : 1;

    // What the account holds comes next, and it has to be decided before price.
    //
    // Price cannot decide it, because on NEAR the picker is not priced at all: the
    // value comes from the curated list, and a held token that list has never heard of
    // has no value to sort with. The old order — value first, `undefined` last — put
    // exactly those tokens at the bottom, so USDC sat in the account and did not appear
    // in the list of things to receive. The tokens a user owns are the tokens they are
    // most likely to want more of, which is the whole argument for merging holdings in.
    //
    // This is also what makes the two ends of the form agree. The spend side is the
    // wallet's holdings; the receive side now leads with them too, rather than leading
    // with whatever happens to carry a price.
    const aHeld = a.held !== undefined && a.held > 0n;
    const bHeld = b.held !== undefined && b.held > 0n;
    if (aHeld !== bHeld) return aHeld ? -1 : 1;

    // Value orders the held group, and an unvalued one still beats anything unheld.
    //
    // `bridgeable` is only a tie-break *within* the unheld group now. It used to be
    // consulted above this, which put the bridge's own eight assets ahead of a balance
    // the account actually had — the receive list read as "the bridge's catalogue"
    // rather than as "your tokens, then the bridge's".
    const ah = a.heldUsd;
    const bh = b.heldUsd;
    if (ah !== undefined || bh !== undefined) {
      if (ah === undefined) return 1;
      if (bh === undefined) return -1;
      if (ah !== bh) return bh - ah;
    }
    if (a.bridgeable !== b.bridgeable) return a.bridgeable ? -1 : 1;
    return 0;
  });
}

/**
 * What the search box should offer as it is typed.
 *
 * On NEAR the indexer has a real query endpoint, which finds tokens the browsable
 * list does not carry and ranks held ones first. On Solana there is no equivalent
 * beyond the list itself, so the query filters what is already loaded — an honest
 * difference between a query API and a list, rather than pretending both are the
 * same and leaving a user wondering why their token is missing.
 */
export async function suggestTargets(
  network: Network,
  query: string,
  options: { accountId?: string; loaded?: CatalogToken[] } = {},
): Promise<CatalogToken[]> {
  if (query.trim() === "") return [];

  // Both sources, merged, chain-scoped by whatever each can do.
  //
  // DexScreener is the only one that searches across chains and carries an icon,
  // and it has no chain filter — `?q=shitzu&chainId=near` returns the same Solana
  // pairs as without it, verified. So its results are filtered here, on the
  // client, which means "only tokens on the destination chain" is a promise this
  // code has to keep rather than one the API keeps for it.
  //
  // The chain's own indexer is scoped server-side by construction, so on NEAR it
  // goes first and DexScreener only adds what it missed. That ordering is the
  // substance of the chain-scoping, not cosmetics: the indexer is also the only
  // source that knows about a NEAR memecoin with no pool DexScreener has indexed,
  // which is most of the market.
  const dexPromise = searchTokens(network, query).catch(() => []);
  const nativePromise =
    network === "near"
      ? searchNear(query, options.accountId).catch(() => [])
      : Promise.resolve([]);

  const [native, dex] = await Promise.all([nativePromise, dexPromise]);

  const byAddress = new Map<string, CatalogToken>();
  for (const token of native) byAddress.set(token.address, token);

  /** A hit that only DexScreener offered, and without artwork. */
  const blankFromDex: string[] = [];

  for (const hit of dex) {
    if (byAddress.has(hit.tokenId)) {
      // The indexer's copy is chain-native and priced; the only thing worth taking
      // from here is artwork, which most of these entries are missing.
      const existing = byAddress.get(hit.tokenId) as CatalogToken;
      byAddress.set(hit.tokenId, {
        ...existing,
        icon: existing.icon || (hit.icon ?? ""),
        price: existing.price ?? hit.price,
      });
      continue;
    }
    byAddress.set(hit.tokenId, {
      tokenId: hit.tokenId,
      symbol: hit.symbol,
      icon: hit.icon ?? "",
      address: hit.tokenId,
      decimals: hit.decimals,
      price: hit.price,
      bridgeable: false,
      origin: "aggregator" as const,
    });
    if (!hit.icon) blankFromDex.push(hit.tokenId);
  }

  // DexScreener carries the row but often not the artwork: on NEAR most tokens have no
  // image there, while the indexer illustrates nearly all of them. A hit that reached
  // the list only through DexScreener is looked up by address — an exact lookup, which
  // is the case reputation filtering also has to step aside for — so the row does not
  // render a grey circle for a token whose icon the app can fetch.
  if (network === "near" && blankFromDex.length > 0) {
    await Promise.all(
      blankFromDex.map(async (address) => {
        const found = (await searchNear(address).catch(() => [])).find(
          (token) => token.address === address,
        );
        const existing = byAddress.get(address);
        if (!found?.icon || !existing) return;
        byAddress.set(address, { ...existing, icon: found.icon });
      }),
    );
  }

  if (byAddress.size > 0) return [...byAddress.values()];

  // Nothing from either API. On Solana that leaves the list already loaded, which
  // is the only thing that knows about a token with no pool at all.
  const needle = query.trim().toLowerCase();
  return (options.loaded ?? [])
    .filter(
      (token) =>
        token.symbol.toLowerCase().includes(needle) ||
        token.tokenId.toLowerCase().includes(needle),
    )
    .slice(0, 40);
}

export type { Registry };
