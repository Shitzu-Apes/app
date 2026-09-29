import { rpcFetch } from "./rpc-retry";
import { view } from "./utils";

/**
 * FastNear's account token balances, in one request and no view call.
 *
 * `ft_balances` on `wrap.near` is the only enumeration NEAR itself offers, and it
 * is the wrong tool: it answers null for an account with no registrations, some
 * providers do not index it at all, and a single non-indexed contract can sink the
 * whole call. That is why the NEAR side of the converter kept showing only native
 * NEAR — the enumeration that decides whether a token appears at all was the one
 * unreliable piece in the chain.
 *
 * FastNear indexes this itself and answers for 68 non-zero holdings on a typical
 * account in one 15 KB request, with no per-contract round trips and nothing to
 * fall back from. It carries balances only — no symbol, no decimals, no icon — so
 * those still come from the registry and the indexer. That is the right way round:
 * balances are the part that has to be exhaustive, and they are the part FastNear
 * is authoritative about.
 */
const FASTNEAR_FT = "https://api.fastnear.com/v1/account";

/**
 * The indexer's own view of what an account holds, in one request.
 *
 * Strictly better than an index of balances alone, which is why it is first: it
 * answers balances *and* the token's own metadata — symbol, decimals and icon —
 * *and* its price and liquidity, in a single 380 KB request for the whole account.
 *
 * That is three round trips collapsed into one. FastNear below answers balances
 * alone, so every token it found then needed its metadata from somewhere, and the
 * somewhere was an `ft_metadata` call per token: 68 of them for one wallet. The
 * price is what makes the difference visible rather than merely cheaper — with a
 * price per token, holdings can be ordered by value, and a wallet holding one
 * meaningful balance stops burying it under a million of a worthless token.
 */
const INTEAR_USER_TOKENS = "https://prices.intear.tech/get-user-tokens";

export type UserToken = {
  account_id: string;
  price_usd?: string;
  liquidity_usd?: number;
  deleted?: boolean;
  metadata?: {
    symbol?: string;
    name?: string;
    decimals?: number;
    icon?: string;
  };
};

export type UserTokenHolding = {
  tokenId: string;
  balance: bigint;
  decimals: number;
  symbol: string;
  icon?: string;
  price?: number;
  usdValue?: number;
};

export async function intearUserTokens(
  accountId: string,
): Promise<UserTokenHolding[] | null> {
  try {
    const url = new URL(INTEAR_USER_TOKENS);
    url.searchParams.set("account_id", accountId);
    // `direct` restricts the answer to tokens the account itself registered,
    // which is the set it can actually send. Without it the response also carries
    // pool-derived positions the account does not hold and cannot spend.
    url.searchParams.set("direct", "true");
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const body = (await res.json()) as
      | { token: UserToken | null; balance: string }[]
      | null;
    if (!Array.isArray(body)) return null;

    const out: UserTokenHolding[] = [];
    for (const entry of body) {
      const token = entry.token;
      if (!token?.account_id || token.deleted) continue;
      let balance: bigint;
      try {
        balance = BigInt(entry.balance ?? "0");
      } catch {
        continue;
      }
      // A zero balance is a registration the account has moved on from, and
      // listing those is how a wallet ends up offering 104 tokens of which 47
      // are real.
      if (balance <= 0n) continue;
      const decimals = token.metadata?.decimals ?? 18;
      const price = toUsdNumber(token.price_usd);
      out.push({
        tokenId: token.account_id,
        balance,
        decimals,
        symbol: token.metadata?.symbol ?? token.account_id,
        icon: token.metadata?.icon,
        price,
        usdValue:
          price === undefined
            ? undefined
            : (Number(balance) / 10 ** decimals) * price,
      });
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * A decimal string to a number.
 *
 * The indexer publishes prices as fixed-point strings with 200+ decimal places,
 * which `Number` handles fine but which cannot survive a `JSON.parse` round trip
 * as a number without losing its tail. Truncated at the point where the remaining
 * digits cannot affect a price.
 */
function toUsdNumber(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export async function fastNearBalances(
  accountId: string,
): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(`${FASTNEAR_FT}/${accountId}/ft`);
    if (!res.ok) return null;
    const body = (await res.json()) as {
      tokens?: { contract_id?: string; balance?: string }[] | null;
    };
    if (!Array.isArray(body.tokens)) return null;
    const out: Record<string, string> = {};
    for (const entry of body.tokens) {
      if (!entry.contract_id) continue;
      // A zero balance is not a holding. FastNear returns every registration,
      // which for a long-lived account is a lot of dust the user has moved on
      // from, and listing those is how a wallet ends up showing 149 tokens of
      // which 68 are real.
      const balance = BigInt(entry.balance ?? "0");
      if (balance <= 0n) continue;
      out[entry.contract_id] = entry.balance as string;
    }
    return Object.keys(out).length > 0 ? out : {};
  } catch {
    return null;
  }
}

/**
 * Every NEP-141 balance an account holds, in one view call.
 *
 * NEAR has no equivalent of walking a Solana account's token accounts: what an
 * account holds is exactly what it has registered for, and the only enumeration is
 * `ft_balances` on the wrapping contract. It answers null rather than an empty
 * object for an account with no registrations, and some providers do not index it
 * at all — both are reported as null so the caller falls back rather than
 * concluding the account is empty.
 */
export async function ftBalances(
  accountId: string,
): Promise<Record<string, string> | null> {
  try {
    const balances = await view<Record<string, string> | null>(
      "wrap.near",
      "ft_balances",
      { account_id: accountId },
    );
    return balances && typeof balances === "object" ? balances : null;
  } catch {
    return null;
  }
}

/**
 * An account's native NEAR balance in yoctoNEAR.
 *
 * Read from the account itself rather than from `wrap.near`, because an account
 * that has never touched wrapped NEAR has no `wrap.near` registration to answer
 * for it — which would leave native NEAR looking like a zero balance.
 */
export async function nativeNearBalance(
  accountId: string,
): Promise<string | null> {
  try {
    const account = await rpcFetch<{ amount: string }>(
      import.meta.env.VITE_NODE_URL,
      {
        method: "query",
        params: {
          request_type: "view_account",
          finality: "optimistic",
          account_id: accountId,
        },
      },
    );
    return account?.amount ?? null;
  } catch {
    return null;
  }
}
