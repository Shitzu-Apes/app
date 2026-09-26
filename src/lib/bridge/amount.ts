import { FixedNumber } from "$lib/util";

/**
 * Smallest wNEAR amount the Omni Bridge deposit will accept.
 *
 * The bridge takes its fee in wNEAR (`transferred_token_fee`, ~0.0024 wNEAR on
 * mainnet). Anything at or below the fee cannot be deposited, so the UI rejects
 * it up front rather than letting the transaction revert.
 */
export const MIN_BRIDGEABLE_WNEAR = 2_500_000n; // 0.0025 wNEAR at 9 decimals

/**
 * Parse a decimal string into base units. Returns null for anything that is not
 * a plain non-negative decimal, or that carries more precision than `decimals`.
 */
export function parseBaseUnits(
  value: string | undefined,
  decimals: number,
): bigint | null {
  if (!value) return null;
  const cleaned = value.trim();
  if (!cleaned || !/^\d*\.?\d*$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  if (frac.length > decimals) return null;
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  try {
    return BigInt((whole || "0") + padded);
  } catch {
    return null;
  }
}

export function formatBaseUnits(base: bigint | null, decimals: number): string {
  if (base === null) return "0";
  return new FixedNumber(base, decimals).format({ maximumFractionDigits: 6 });
}

export type BridgeGateInput = {
  amount: bigint | null;
  /** wNEAR that will be deposited, after the swap leg. */
  bridgedWnear: bigint | null;
  needsSwap: boolean;
  /** null while a quote is in flight or when Jupiter has no route. */
  quoteAvailable: boolean | null;
  nearConnected: boolean;
  solanaConnected: boolean;
  isBridging: boolean;
  /**
   * The wNEAR Omni Bridge route is mainnet-only: Jupiter only quotes mainnet
   * pools and testnet's bridge contract has no wNEAR token registered, so a
   * testnet deposit can never settle.
   */
  supported: boolean;
};

export type BridgeGate = {
  canSubmit: boolean;
  label: string;
  tooSmall: boolean;
  /** True when the primary action should open the NEAR wallet selector. */
  needsNearConnect: boolean;
  needsSolanaConnect: boolean;
};

/**
 * Single decision point for the bridge form: whether the action is available and
 * what its button should say. Extracted from the component so the wallet-prompt
 * behaviour is testable without mounting Svelte.
 */
export function bridgeGate({
  amount,
  bridgedWnear,
  needsSwap,
  quoteAvailable,
  nearConnected,
  solanaConnected,
  isBridging,
  supported,
}: BridgeGateInput): BridgeGate {
  // The sheet leads with the "From" (Solana) card, so prompt in that order.
  const needsSolanaConnect = !solanaConnected;
  const needsNearConnect = solanaConnected && !nearConnected;
  const tooSmall =
    bridgedWnear !== null && bridgedWnear <= MIN_BRIDGEABLE_WNEAR;

  const hasAmount = amount !== null && amount > 0n;
  const quoteOk = !needsSwap || quoteAvailable === true;

  const canSubmit =
    supported &&
    !isBridging &&
    nearConnected &&
    solanaConnected &&
    hasAmount &&
    !tooSmall &&
    quoteOk;

  let label: string;
  if (isBridging) label = "Bridging…";
  else if (!supported) label = "Mainnet only";
  else if (needsSolanaConnect) label = "Connect Solana wallet";
  else if (needsNearConnect) label = "Connect NEAR wallet";
  else if (!hasAmount) label = "Enter an amount";
  else if (tooSmall) label = "Amount too small";
  else if (needsSwap && quoteAvailable === false) label = "No route available";
  else if (needsSwap && quoteAvailable === null) label = "Fetching quote…";
  else label = needsSwap ? "Buy NEAR & bridge" : "Bridge to Near";

  return {
    canSubmit,
    label,
    tooSmall,
    needsNearConnect,
    needsSolanaConnect,
  };
}
