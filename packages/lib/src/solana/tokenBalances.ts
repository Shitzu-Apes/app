import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

import {
  fetchOnChainMetadata,
  knownIcon,
  knownMetadata,
  knownSymbol,
  resolveIconFromUri,
} from "./metadata";

const JUPITER_TOKEN_SEARCH = "https://lite-api.jup.ag/tokens/v2/search";

/** Wrapped SOL mint, the address form of native SOL. */
export const WSOL_MINT = "So11111111111111111111111111111111111111112";

export type WalletToken = {
  mint: string;
  /** Base units, using the mint's own decimals. */
  balance: bigint;
  decimals: number;
  /** From Jupiter's token list; falls back to a shortened mint address. */
  symbol: string;
  name?: string;
  icon?: string;
  /** Metadata document from the token's on-chain record, if it has one. */
  metadataUri?: string;
  /** USD price per whole token, when Jupiter quotes one. */
  usdPrice?: number;
  /** Balance valued in USD, the only ordering that means anything across tokens. */
  usdValue?: number;
  /**
   * Jupiter lists the token, which is our proxy for "can be swapped". A token
   * it does not know may still route, so this only drives what we offer up
   * front, not whether an attempt is allowed.
   */
  routable: boolean;
  /** True for native SOL, which has no token account. */
  native: boolean;
};

function shortenMint(mint: string): string {
  return `${mint.slice(0, 4)}…${mint.slice(-3)}`;
}

/**
 * Every SPL token the wallet holds a non-zero balance in, plus native SOL.
 *
 * Balances and decimals come straight from the RPC, so nothing is hardcoded and
 * a token with unusual decimals still formats correctly.
 */
export async function fetchWalletTokens(
  connection: Connection,
  owner: PublicKey,
  {
    includeSol = true,
    signal,
  }: { includeSol?: boolean; signal?: AbortSignal } = {},
): Promise<WalletToken[]> {
  const programs = [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID];
  const raw = await Promise.all(
    programs.map(async (programId) => {
      try {
        // The parsed variant returns `data.parsed`; the unparsed one returns
        // base64, which would leave every balance undefined.
        return await connection.getParsedTokenAccountsByOwner(
          owner,
          { programId },
          undefined,
        );
      } catch {
        return { value: [] as { account: { data: { parsed?: unknown } } }[] };
      }
    }),
  );

  const seen = new Set<string>();
  const tokens: WalletToken[] = [];

  for (const { value } of raw) {
    for (const entry of value) {
      const parsed = entry.account.data.parsed as
        | {
            info?: {
              mint?: string;
              tokenAmount?: { amount?: string; decimals?: number };
            };
          }
        | undefined;
      const info = parsed?.info;
      const mint = info?.mint;
      if (!mint || seen.has(mint)) continue;

      let balance = 0n;
      try {
        balance = BigInt(info?.tokenAmount?.amount ?? "0");
      } catch {
        continue;
      }
      // Dust and closed accounts are noise in a picker.
      if (balance <= 0n) continue;

      seen.add(mint);
      tokens.push({
        mint,
        balance,
        decimals: info?.tokenAmount?.decimals ?? 0,
        symbol: shortenMint(mint),
        routable: false,
        native: false,
      });
    }
  }

  if (includeSol) {
    const lamports = BigInt(
      await connection.getBalance(owner, undefined).catch(() => 0),
    );
    if (lamports > 0n) {
      tokens.unshift({
        mint: WSOL_MINT,
        balance: lamports,
        decimals: 9,
        symbol: "SOL",
        name: "Solana",
        routable: true,
        native: true,
      });
    }
  }

  return enrichWithPrices(
    await enrichWithIcons(
      await applyLocalMetadata(
        await applyOnChainMetadata(tokens, connection),
        signal,
      ),
      signal,
    ),
    signal,
  );
}

/**
 * Apply the tokens we ship assets for, before anything hits the network.
 *
 * SOL and NEAR are the two the bridge is about, so they must render correctly
 * even when every third-party API is unavailable.
 */
async function applyLocalMetadata(
  tokens: WalletToken[],
  signal?: AbortSignal,
): Promise<WalletToken[]> {
  for (const token of tokens) {
    const known = knownMetadata(token.mint);
    if (!known) continue;
    token.symbol = known.symbol ?? token.symbol;
    token.name = known.name ?? token.name;
    token.icon = known.icon;
    token.routable = true;
  }
  return enrichWithMetadata(tokens, signal);
}

/**
 * Fill symbols and names from the chain.
 *
 * This is the primary source because it is a single batched RPC call that no
 * third party can rate-limit out. Some issuers pad or mangle their fields and
 * some tokens have no metadata account at all, so the token list API still runs
 * afterwards to fill the gaps.
 */
async function applyOnChainMetadata(
  tokens: WalletToken[],
  connection: Connection,
): Promise<WalletToken[]> {
  const onChain = await fetchOnChainMetadata(
    connection,
    tokens.filter((t) => !t.native).map((t) => t.mint),
  );
  for (const token of tokens) {
    const meta = onChain.get(token.mint);
    if (!meta) continue;
    // Never overwrite a symbol we ship ourselves.
    if (!knownSymbol(token.mint) && meta.symbol) token.symbol = meta.symbol;
    if (!token.name && meta.name) token.name = meta.name;
    if (meta.uri) token.metadataUri = meta.uri;
  }
  return tokens;
}

/**
 * Resolve icons: the local asset first, then the metadata document, then
 * Jupiter's list. Icon documents are cached because an icon never changes.
 */
async function enrichWithIcons(
  tokens: WalletToken[],
  signal?: AbortSignal,
): Promise<WalletToken[]> {
  await Promise.all(
    tokens.map(async (token) => {
      if (token.icon) return;
      if (!token.metadataUri) return;
      const icon = await withJupiterSlot(() =>
        resolveIconFromUri(token.metadataUri!, signal),
      );
      if (icon) token.icon = icon;
    }),
  );
  return tokens;
}

type JupiterToken = {
  id?: string;
  symbol?: string;
  name?: string;
  icon?: string;
};

/**
 * Module-level caches, of resolved values rather than promises.
 *
 * A busy wallet holds dozens of tokens and Jupiter rate-limits, so the cost is now
 * kept low by asking once per hundred mints (see `fetchJupiterMetadata`) rather than
 * by throttling a stream of per-mint calls. Caching what came back means a second
 * wallet read costs nothing, and reopening the sheet is instant.
 */
const metadataCache = new Map<string, JupiterToken>();
const priceCache = new Map<string, number>();

/** How many Jupiter calls may be in flight at once. */
const MAX_CONCURRENT_JUPITER = 4;
let inFlight = 0;
const queue: (() => void)[] = [];

async function withJupiterSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_CONCURRENT_JUPITER) {
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

/**
 * How many mints go into one search call.
 *
 * Jupiter's own limit, and the whole point of this module's batching: the search
 * endpoint takes comma-separated mints, up to 100 in a query. It used to be asked for
 * one mint at a time, so a wallet holding sixty tokens cost sixty requests against a
 * public endpoint that rate-limits — and the symptom was tokens silently degrading to
 * shortened mints with no price, which reads as the app being broken rather than as a
 * rate limit. One call now covers a large wallet outright.
 */
const METADATA_BATCH = 100;

/**
 * Metadata for a set of mints, in one call per hundred.
 *
 * The response is matched by `id` and never by position. A mint Jupiter does not know
 * is simply **absent** from the array rather than returned as a null, so positional
 * matching walks off the end as soon as one mint is missing and attaches the next
 * token's symbol to the wrong token — a silent, plausible-looking corruption rather
 * than a visible failure. Verified live: four mints in, three out, absent not null.
 */
async function fetchJupiterMetadata(
  mints: string[],
  signal?: AbortSignal,
): Promise<Map<string, JupiterToken>> {
  const wanted = mints.filter((mint) => !metadataCache.has(mint));
  const found = new Map<string, JupiterToken>();
  for (const [mint, meta] of metadataCache) {
    if (meta) found.set(mint, meta);
  }
  if (wanted.length === 0) return found;

  for (let i = 0; i < wanted.length; i += METADATA_BATCH) {
    const batch = wanted.slice(i, i + METADATA_BATCH);
    // One backoff retry: a cold load can catch a rate limit, and a token falling back
    // to a shortened mint is a visibly worse experience than a short wait.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await withJupiterSlot(() =>
          fetch(
            `${JUPITER_TOKEN_SEARCH}?query=${encodeURIComponent(batch.join(","))}`,
            { signal },
          ),
        );
        if (res.status === 429 && attempt === 0) {
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }
        if (!res.ok) break;
        const body = (await res.json()) as JupiterToken[];
        if (Array.isArray(body)) {
          for (const token of body) {
            if (token?.id) {
              found.set(token.id, token);
              metadataCache.set(token.id, token);
            }
          }
        }
        break;
      } catch {
        break;
      }
    }
  }
  return found;
}

/**
 * Fill in symbol/name/icon from Jupiter's token list.
 *
 * Failures are tolerated per token: a token with no metadata still shows up with
 * a shortened mint, which is better than dropping it from the picker.
 */
export async function enrichWithMetadata(
  tokens: WalletToken[],
  signal?: AbortSignal,
): Promise<WalletToken[]> {
  // Native SOL needs nothing from anyone, so it is not asked about.
  const mints = tokens.filter((t) => !t.native).map((t) => t.mint);
  const byMint = await fetchJupiterMetadata(mints, signal);

  for (const token of tokens) {
    if (token.native) continue;
    const meta = byMint.get(token.mint);
    if (!meta) continue;
    // Anything we ship an asset for is already correct locally, and must not
    // be degraded by a third party: Jupiter calls the wrapped NEAR token
    // "wNEAR" and has no icon for it, whereas the product deliberately calls
    // it NEAR and has an icon on disk.
    if (knownSymbol(token.mint)) {
      token.routable = true;
      continue;
    }
    token.symbol = meta.symbol ?? token.symbol;
    token.name = meta.name;
    token.icon = meta.icon;
    token.routable = true;
  }

  // Routable first, then by USD value. Comparing raw base units across tokens
  // would be meaningless: 15 tokens with 6 decimals outranks 4 tokens with 9
  // purely because of the exponent. Native SOL leads because it is also what
  // pays the network fee.
  return tokens.sort((a, b) => {
    if (a.native !== b.native) return a.native ? -1 : 1;
    if (a.routable !== b.routable) return a.routable ? -1 : 1;
    const av = a.usdValue ?? -1;
    const bv = b.usdValue ?? -1;
    if (av === bv) {
      return toSolAmount(a) === toSolAmount(b)
        ? 0
        : toSolAmount(a) > toSolAmount(b)
          ? -1
          : 1;
    }
    return av > bv ? -1 : 1;
  });
}

const JUPITER_PRICE = "https://lite-api.jup.ag/price/v3";

/**
 * Mints per price call.
 *
 * A hundred, which is the most the search endpoint takes and which the price endpoint
 * accepts too — verified live, so the two can be asked in the same sized bites and a
 * large wallet costs one request of each rather than several.
 */
const PRICE_BATCH = 100;

/**
 * Fill in USD prices so holdings can be ordered by value.
 *
 * A wallet routinely holds millions of a worthless token alongside a few
 * hundred dollars of USDC, so ordering by token count buries the balance the
 * user actually cares about. Unpriced tokens keep `usdValue` undefined and sort
 * last.
 */
export async function enrichWithPrices(
  tokens: WalletToken[],
  signal?: AbortSignal,
): Promise<WalletToken[]> {
  for (let i = 0; i < tokens.length; i += PRICE_BATCH) {
    const batch = tokens.slice(i, i + PRICE_BATCH);
    const ids = batch.map((t) => t.mint).join(",");
    try {
      const res = await withJupiterSlot(() =>
        fetch(`${JUPITER_PRICE}?ids=${ids}`, { signal }),
      );
      if (!res.ok) continue;
      const body = (await res.json()) as Record<
        string,
        { usdPrice?: number } | undefined
      >;
      for (const token of batch) {
        const price = body[token.mint]?.usdPrice;
        if (typeof price !== "number") continue;
        priceCache.set(token.mint, price);
        token.usdPrice = price;
        token.usdValue = toSolAmount(token) * price;
      }
    } catch {
      // Pricing is a nicety; the list is still usable without it.
    }
  }

  // Anything not in this response may be cached from a previous call.
  for (const token of tokens) {
    if (token.usdPrice !== undefined) continue;
    const cached = priceCache.get(token.mint);
    if (cached === undefined) continue;
    token.usdPrice = cached;
    token.usdValue = toSolAmount(token) * cached;
  }

  return tokens.sort((a, b) => {
    if (a.native !== b.native) return a.native ? -1 : 1;
    if (a.routable !== b.routable) return a.routable ? -1 : 1;
    const av = a.usdValue ?? -1;
    const bv = b.usdValue ?? -1;
    if (av === bv) {
      return toSolAmount(a) === toSolAmount(b)
        ? 0
        : toSolAmount(a) > toSolAmount(b)
          ? -1
          : 1;
    }
    return av > bv ? -1 : 1;
  });
}

export function toSolAmount(token: WalletToken): number {
  if (token.decimals === 0) return Number(token.balance);
  return Number(token.balance) / 10 ** token.decimals;
}

export function formatTokenBalance(token: WalletToken): string {
  if (token.balance === 0n) return "0";
  if (token.decimals === 0) return token.balance.toLocaleString();

  const value = Number(token.balance) / 10 ** token.decimals;
  if (value >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  // Never render a non-zero balance as "0": tiny balances need significant
  // digits rather than a fixed decimal count.
  return value.toLocaleString(undefined, { maximumSignificantDigits: 6 });
}

export { knownIcon, knownMetadata, knownSymbol };
export { LAMPORTS_PER_SOL };
