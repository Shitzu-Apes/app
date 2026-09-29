/**
 * Dust: a balance too small to be worth a row.
 *
 * An SPL or NEP-141 account routinely holds hundreds of accounts it has never spent —
 * airdropped shards, residue from a swap years ago, an account someone else opened.
 * Every one of them is a real balance and none of them is a decision, so a list ordered
 * honestly by them buries the two or three that matter under a wall of zeroes the user
 * cannot act on.
 *
 * The threshold is in USD, and deliberately not in base units: base units are
 * meaningless across tokens with different decimals, so a fixed number of units is
 * generous for a 6-decimal token and dust for a 9-decimal one.
 *
 * A balance with **no** price is never dust. Not being able to value something is not
 * the same as it being worthless, and quietly hiding a token because the indexer has
 * never heard of its price is how a held token disappears — which is the mistake this
 * whole area has been making.
 */
export const DUST_USD = 0.01;

/** A balance, its value if known, and the decimals it is denominated in. */
export type DustableBalance = {
  balance: bigint;
  usdValue?: number | undefined;
  decimals?: number | undefined;
};

/**
 * Is this balance too small to show?
 *
 * Zero is always dust — that is the overwhelming majority of a real wallet — and a
 * known value under the threshold is dust. Anything unpriced is kept.
 */
export function isDust({ balance, usdValue }: DustableBalance): boolean {
  if (balance <= 0n) return true;
  if (usdValue === undefined) return false;
  return usdValue < DUST_USD;
}
