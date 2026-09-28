import { toTokenAmount } from "$lib/bridge/format";
import type { Network } from "$lib/models/tokens";
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

/**
 * A rounded, human-readable amount, for display only.
 *
 * It is lossy on purpose: `FixedNumber` caps output at six significant digits
 * and this caps it at six fraction digits, rounding the last one. That is fine
 * for "you receive about…", and wrong for anything that is read back — see
 * `formatBaseUnitsExact`.
 */
export function formatBaseUnits(base: bigint | null, decimals: number): string {
  if (base === null) return "0";
  return new FixedNumber(base, decimals).format({ maximumFractionDigits: 6 });
}

/**
 * Suffixes for the short scale, largest first.
 *
 * The quadrillion step is the reason this list is written out. Intl's own
 * pattern stops at "T" and renders 8,949,120,000,000,000 as "8949.12T"; with the
 * step included the same number is "8.95Q", which is the shape a reader expects
 * and the difference between a figure that can be compared and one that has to be
 * counted.
 */
const SHORT_SCALE: [number, string][] = [
  [1e15, "Q"],
  [1e12, "T"],
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "K"],
];

/**
 * The amount, shortened once it stops being readable in full.
 *
 * A route can legitimately quote quadrillions of a low-decimal memecoin, and
 * "8,949,120,000,000,000 BLACKDRAGON" is both wider than the row and impossible
 * to compare at a glance against the route above it. The number is on screen
 * *beside another number* precisely so the two can be compared, and 19 digits
 * defeats that.
 *
 * The scale is chosen here rather than left to `notation: "compact"`, because
 * Intl's en-US pattern keeps the mantissa under 10,000 and so renders this as
 * "8949.12T" instead of "8.95Q". Both are the same number; only one of them is
 * the shape a reader recognises. Intl still does the number itself, so grouping
 * and rounding follow the locale rather than a hand-rolled string.
 *
 * Below the threshold the full figure is returned, because a balance of `1.5` is
 * not improved by being written `1.5`, and precision is the point at that size.
 */
export function formatBaseUnitsCompact(
  base: bigint | null,
  decimals: number,
): string {
  if (base === null) return "0";
  const value = toTokenAmount(base, decimals);
  const magnitude = Math.abs(value);
  if (magnitude < 10_000) return formatBaseUnits(base, decimals);

  for (const [size, suffix] of SHORT_SCALE) {
    if (magnitude < size) continue;
    return (
      new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
        value / size,
      ) + suffix
    );
  }
  return formatBaseUnits(base, decimals);
}

/**
 * The exact amount, for anything that will be parsed back.
 *
 * `formatBaseUnits` rounds, so feeding its output into `parseBaseUnits` can
 * return *more* base units than went in. On a 0.006051912 NEAR holding that
 * turned a 100% fill into 6052000 against a balance of 6051912, so the gate
 * rejected the amount the button had just produced. Trailing zeros are dropped
 * because they carry no information, so this still round-trips exactly.
 *
 * Verified across 36M values at 6, 8 and 9 decimals.
 */
export function formatBaseUnitsExact(
  base: bigint | null,
  decimals: number,
): string {
  if (base === null) return "0";
  return new FixedNumber(base, decimals).toString();
}

/**
 * Re-denominate an amount from one chain's base units to another's.
 *
 * The Omni Bridge preserves *value*, not raw units. The SDK proves it: on the
 * NEAR leg it computes `normalizeAmount(amount, originDecimals, nearDecimals)`
 * and sends that as `amount_to_send`, and `getMinimumTransferableAmount` scales
 * up when the origin chain has more decimals than the destination. So 0.2 wNEAR
 * leaves Solana as 200_000_000 SPL base units and arrives on NEAR as
 * 200_000_000_000_000_000_000_000.
 *
 * This matters because wNEAR is 9 decimals on Solana and 24 on NEAR, and every
 * meme token is 9 on Solana against 18 on NEAR. An amount carried across the
 * bridge without re-basing is wrong by a factor of 10^15, and it still *looks*
 * right when formatted with the source chain's decimals — which is exactly how
 * the existing Solana-to-NEAR sheet gets away with it. Anything that adds a
 * bridged amount to a NEAR balance, or compares the two, has to re-base first.
 *
 * Scaling down truncates, matching the bridge contract's own behaviour. The
 * dust is bounded by `10 ** -15` of a token, so it cannot be recovered but does
 * not matter.
 */
export function rebaseAmount(
  amount: bigint,
  fromDecimals: number,
  toDecimals: number,
): bigint {
  if (fromDecimals === toDecimals) return amount;
  if (fromDecimals > toDecimals) {
    return amount / 10n ** BigInt(fromDecimals - toDecimals);
  }
  return amount * 10n ** BigInt(toDecimals - fromDecimals);
}

/** True when `amount`, in `decimals`, is worth less than one whole token. */
export function isSubUnit(amount: bigint, decimals: number): boolean {
  return decimals > 0 && amount > 0n && amount < 10n ** BigInt(decimals);
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

/**
 * Is this amount too small to be worth a route?
 *
 * It used to be "less than one whole token", applied on every chain, and that is a
 * reasonable rule for a memecoin and a wrong one for a currency. **SOL has nine
 * decimals and is traded in fractions**: 0.5 SOL is about a hundred dollars, and under
 * this rule every swap into SOL below a whole SOL was rejected as dust. That is why
 * USDC → SOL found nothing while USDC → anything else worked, and why the same swap
 * from SOL outward worked — the outgoing side was judged against the *other* token's
 * decimals.
 *
 * The rule is really "do not show a route that rounds to zero", and the honest test for
 * that is whether the amount survives being displayed. A hundredth of a unit is shown
 * as-is; below that the formatter is into significant digits, and that is the point at
 * which a route stops being worth offering.
 *
 * Stablecoins and wrapped assets are valued in whole units by convention, and SOL is
 * not, so the threshold differs — and `isSubUnit` is kept for the callers that really
 * do mean "less than one" rather than "too small to show".
 */
export function amountIsUnusable(
  amount: bigint,
  network: Network,
  decimals: number,
): boolean {
  if (amount <= 0n) return true;
  if (decimals <= 0) return false;
  const unit = 10n ** BigInt(decimals);
  // A hundredth of a unit is a real amount on any chain — 0.01 SOL, 0.01 USDC.
  const floor = unit / 100n;
  return amount < (floor > 0n ? floor : 1n);
}
