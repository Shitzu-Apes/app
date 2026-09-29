import { CHAINS } from "./chains";
import type { BridgeableToken } from "./rail";

/**
 * Presentation helpers for the Convert form.
 *
 * Pulled out of the component so the decisions are testable and so the form does
 * not accumulate formatting branches. The two that matter most are the USD
 * formatter and the source-token fallback, because both have a wrong-looking
 * failure mode: a raw base64 data-uri icon renders as a broken image, and a
 * missing price renders as a confident "$0.00".
 */

/** Quick-fill steps, matching the existing Solana-to-NEAR sheet. */
export const PERCENTS = [25, 50, 75, 100] as const;

/**
 * USD, at a precision that suits the magnitude.
 *
 * A memecoin balance is routinely a fraction of a cent and a NEAR balance
 * routinely runs to thousands, so a fixed two decimals renders the first as
 * "$0.00" and the second as "$1,234.00" — both of which read as wrong. Three
 * bands, and anything under a hundredth of a cent falls back to significant
 * digits rather than rounding to zero, because "almost nothing" and "nothing" are
 * different facts.
 */
export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "";
  if (value === 0) return "$0.00";
  if (value >= 1000) {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(3)}`;
  return `$${value.toPrecision(2)}`;
}

/**
 * USD for a value known only in base units.
 *
 * Returns an empty string rather than "$0.00" when the price is unknown, so the
 * caller can leave the slot blank. A confidently wrong price is worse than no
 * price: a memecoin the app cannot price is common, and showing it as free would
 * make the ranking look broken.
 */
export function usdFor(
  amount: bigint | null | undefined,
  decimals: number,
  price: number | null | undefined,
): string {
  if (amount === null || amount === undefined || amount <= 0n) return "";
  if (price === null || price === undefined || !Number.isFinite(price))
    return "";
  return formatUsd(toTokenAmount(amount, decimals) * price);
}

/**
 * Base units as a JS number, for display maths only.
 *
 * Lossy past 2^53, which is around 9 million tokens at 9 decimals. That is far
 * past any amount worth showing to two significant figures, and every consumer
 * here is a formatter or a sort key rather than an exact calculation.
 */
export function toTokenAmount(amount: bigint, decimals: number): number {
  if (decimals === 0) return Number(amount);
  return Number(amount) / 10 ** decimals;
}

/** What to show when a token has no icon anywhere. */
export function iconFallback(icon: string | undefined): string | undefined {
  // The registry stores some icons as base64 data URIs, which render fine but
  // make the markup unreadable and cannot be styled. Everything else is a path.
  if (!icon) return undefined;
  return icon;
}

/** Chain icon for a network, with the label the toggle should use. */
export function chainInfo(network: keyof typeof CHAINS) {
  return { icon: CHAINS[network].icon, name: CHAINS[network].name };
}

/**
 * A source token the user can pick, ready to render.
 *
 * Built here rather than in the component so the wallet's own shape — mints,
 * balances, sometimes a missing symbol — is resolved in one place. The Solana
 * wallet reports native SOL under its wrapped mint, and showing that mint as the
 * label is the single most confusing thing this form can do: the user picked
 * "SOL" and the form answered with a 44-character address.
 */
export type SourceOption = {
  id: string;
  symbol: string;
  icon?: string;
  balance: bigint;
  decimals: number;
  usdValue?: number;
  /**
   * USD price per whole token, as distinct from `usdValue` which is the whole
   * holding's worth.
   *
   * Both are needed and they are not interchangeable: the list row shows the
   * holding's value, and the amount field's hint prices the amount the user typed.
   * Passing the total where the price belongs overstates the hint by the size of
   * the balance.
   */
  price?: number;
  /** The aggregator has no route for this pair, so it is offered but flagged. */
  routable: boolean;
  native: boolean;
};

/** Shorten an address or mint for a row that has no better label. */
export function shortAddress(value: string): string {
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

/**
 * A readable label for any token id.
 *
 * A source token is whatever the wallet holds, so its id is frequently not in the
 * registry at all. Falling back to the raw id would put a contract address where
 * a symbol belongs, so the address is shortened instead and the row still reads
 * as a token.
 */
export function labelFor(
  id: string,
  registry: Record<string, { symbol: string }>,
): string {
  return registry[id]?.symbol ?? shortAddress(id);
}

export type { BridgeableToken };
