import type { CatalogToken } from "./catalog";
import { CONVERT_CHAINS, type ConvertChain } from "./rail";

/**
 * The Convert form's state, in the URL.
 *
 * A conversion is "this token, on this chain, into that token, on that chain".
 * All four are worth being able to hand to someone else — a support link that
 * reproduces what the user was looking at is worth a great deal when a transfer
 * fails — and none of them is worth a session store.
 *
 * Only the ends and the target are kept. The amount is deliberately not: it is the
 * one field where a stale value is dangerous, since a shared link could otherwise
 * arrive pre-filled and ready to submit for an amount the sender never chose.
 *
 * Written on change rather than on submit, so the address bar is always a faithful
 * description of the form. That means a `replaceState` rather than a navigation,
 * which is why this cannot be done with `goto` alone.
 */

export type ConvertQuery = {
  from: ConvertChain;
  to: ConvertChain;
  /** The target's registry key when it is a bridge asset, else its address. */
  target?: string;
};

function readChain(value: string | null, fallback: ConvertChain): ConvertChain {
  return value && (CONVERT_CHAINS as readonly string[]).includes(value)
    ? (value as ConvertChain)
    : fallback;
}

const key = (query: ConvertQuery) =>
  `?from=${query.from}&to=${query.to}${query.target ? `&t=${encodeURIComponent(query.target)}` : ""}`;

/** What the current URL asks for, with defaults for anything absent or invalid. */
export function readConvertQuery(search: string): ConvertQuery {
  const params = new URLSearchParams(search);
  // Defaulting to a cross-chain conversion: that is what the tab is for, and
  // `from=near&to=near` is still reachable by editing the URL.
  const from = readChain(params.get("from"), "solana");
  return {
    from,
    to: readChain(params.get("to"), from === "solana" ? "near" : "solana"),
    target: params.get("t") ?? undefined,
  };
}

/**
 * Push the form's state into the URL, without adding a history entry.
 *
 * A navigation per keystroke would be wrong, but this fires only when a chain or
 * the target changes, which is a handful of times per session. `replaceState`
 * rather than a push so Back leaves the page instead of walking through the
 * user's chain-picking.
 *
 * Takes the current location rather than reading the page store, so it is
 * testable and does not depend on store subscription timing.
 */
export function writeConvertQuery(query: ConvertQuery): void {
  const next = key(query);
  const here = `${location.pathname}${location.search}`;
  if (here === next) return;
  history.replaceState(history.state, "", next);
}

/**
 * The token a link's `t` names, by its address and nothing else.
 *
 * Exact on purpose. A search for an address can return other tokens besides the one
 * asked about, and taking the first hit would silently swap the link's target for a
 * different token — a worse failure than not restoring it at all.
 */
export function exactTarget(
  tokens: CatalogToken[],
  address: string,
): CatalogToken | null {
  return tokens.find((token) => token.address === address) ?? null;
}

/**
 * The token a shared link asked for, or null when it cannot be found.
 *
 * The picker's catalogue is the *browsable* list — the bridge's own assets, the
 * chain's curated index, and the wallet's holdings. The search reaches the rest of
 * the market, and `t` is written from a search hit as often as from a row, so a
 * linked target is frequently absent from the list the picker renders. That is what
 * broke the link: the selection was validated against the catalogue, found missing,
 * and replaced by the first row, and the rewritten URL then recorded that instead.
 *
 * The catalogue is consulted before the request because a row already in hand needs
 * no answer from the network, and a failed search is a missing row rather than a
 * thrown form: the caller falls back to the list's own default, as it did before.
 */
export async function resolveTarget(
  address: string,
  deps: {
    /** Rows the caller already has. */
    loaded: CatalogToken[];
    /** The chain's own search, which is what found the token in the first place. */
    lookup: (address: string) => Promise<CatalogToken[]>;
  },
): Promise<CatalogToken | null> {
  const known = exactTarget(deps.loaded, address);
  if (known) return known;
  try {
    return exactTarget(await deps.lookup(address), address);
  } catch {
    return null;
  }
}
