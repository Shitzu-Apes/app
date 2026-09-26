import { FixedNumber } from "$lib/util";

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
  /**
   * The bridge's own fee in wNEAR base units, deducted from the bridged amount.
   * Null until quoted. A deposit at or below this cannot settle, so it also
   * drives the minimum-amount check.
   */
  tokenFee: bigint | null;
  /** True once a transfer has completed, so the form can stop offering it. */
  done?: boolean;
  /**
   * Spendable balance of the selected source token, already net of any SOL that
   * must be held back for fees. Null while balances are still loading, which
   * must not block the form.
   */
  available: bigint | null;
  /**
   * SOL balance and the amount that has to stay put to pay for the deposit.
   * Bridging always costs SOL for the network fee, even when the token being
   * bridged is not SOL, so this is checked independently of the source token.
   */
  solBalance: bigint | null;
  solReserve: bigint;
};

export type BridgeGate = {
  canSubmit: boolean;
  label: string;
  tooSmall: boolean;
  /** True when the primary action should open the NEAR wallet selector. */
  needsNearConnect: boolean;
  needsSolanaConnect: boolean;
  /** Amount that will actually land in the NEAR account, after the fee. */
  netAmount: bigint | null;
  /** The amount is larger than the wallet holds. */
  insufficientBalance: boolean;
  /** The wallet cannot cover the network fee for the deposit. */
  insufficientSol: boolean;
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
  tokenFee,
  done = false,
  available = null,
  solBalance = null,
  solReserve = 0n,
}: BridgeGateInput): BridgeGate {
  // The sheet leads with the "From" (Solana) card, so prompt in that order.
  const needsSolanaConnect = !solanaConnected;
  const needsNearConnect = solanaConnected && !nearConnected;

  // The bridge takes its fee out of the amount, so anything that does not exceed
  // the fee cannot arrive.
  const tooSmall =
    bridgedWnear !== null && tokenFee !== null && bridgedWnear <= tokenFee;

  const netAmount =
    bridgedWnear !== null && tokenFee !== null && bridgedWnear > tokenFee
      ? bridgedWnear - tokenFee
      : null;

  const hasAmount = amount !== null && amount > 0n;

  // Never block on data we have not got: an unknown balance is not a reason to
  // disable the form, only a known-too-small one is.
  const insufficientBalance =
    hasAmount && available !== null && amount > available;
  const insufficientSol = solBalance !== null && solBalance < solReserve;

  const quoteOk = !needsSwap || quoteAvailable === true;
  // Never block on a quote we have not got; only a known-bad quote blocks.
  const feeOk = tokenFee === null || !tooSmall;

  const canSubmit =
    supported &&
    !done &&
    !isBridging &&
    nearConnected &&
    solanaConnected &&
    hasAmount &&
    !tooSmall &&
    !insufficientBalance &&
    !insufficientSol &&
    quoteOk &&
    feeOk;

  let label: string;
  if (done) label = "Done";
  else if (isBridging) label = "Bridging…";
  else if (!supported) label = "Mainnet only";
  else if (needsSolanaConnect) label = "Connect Solana wallet";
  else if (needsNearConnect) label = "Connect NEAR wallet";
  else if (!hasAmount) label = "Enter an amount";
  else if (insufficientBalance) label = "Insufficient balance";
  else if (insufficientSol) label = "Not enough SOL for fees";
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
    netAmount,
    insufficientBalance,
    insufficientSol,
  };
}
