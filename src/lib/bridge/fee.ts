import { ChainKind, omniAddress, type OmniAddress } from "omni-bridge-sdk";

import { getOmniApi } from "./omni";

import type { Network } from "$lib/models/tokens";

/**
 * What the bridge charges to move one token between two chains.
 *
 * `tokenFee` is taken *out of* the amount rather than added on top, so an
 * amount at or below it cannot arrive at all. It is quoted in the source chain's
 * base units for that token: verified on mainnet, a 0.203889181 wNEAR transfer
 * quotes 2064491, which is 0.002064491 wNEAR in SPL units and exactly what the
 * completed transfer deducted. The yoctoNEAR figure in the on-chain transfer
 * message is the bridge's own normalisation, not something the caller applies.
 */
export type BridgeFee = {
  tokenFee: bigint;
  /** Paid on the source chain, in that chain's native units: lamports, gas. */
  nativeFee: bigint;
  usdFee: number | null;
};

/** App network name to the SDK's chain kind, for every chain the app knows. */
export const CHAIN_KIND: Record<Network, ChainKind> = {
  near: ChainKind.Near,
  solana: ChainKind.Sol,
  base: ChainKind.Base,
  arbitrum: ChainKind.Arb,
  ethereum: ChainKind.Eth,
  bnb: ChainKind.Bnb,
};

export type BridgeFeeRequest = {
  from: Network;
  to: Network;
  sender: string;
  recipient: string;
  /** Address of the token being moved, on the `from` chain. */
  tokenAddress: string;
  amount: bigint;
};

/**
 * Quote the bridge's fee for a transfer that has not been submitted yet.
 *
 * The amount must be in the source chain's base units for the token, which for
 * a route with a source swap is the *swap's* floor rather than what the user
 * typed. Getting this wrong scales the fee by the decimal difference: quoting a
 * NEAR-side amount as if it were an SPL amount overstates it by 10^15 and makes
 * every transfer look too small to cover its own fee.
 */
export async function getBridgeFee({
  from,
  to,
  sender,
  recipient,
  tokenAddress,
  amount,
}: BridgeFeeRequest): Promise<BridgeFee> {
  const fee = await getOmniApi().getFee(
    omniAddress(CHAIN_KIND[from], sender) as OmniAddress,
    omniAddress(CHAIN_KIND[to], recipient) as OmniAddress,
    omniAddress(CHAIN_KIND[from], tokenAddress) as OmniAddress,
    amount,
  );

  return {
    tokenFee: fee.transferred_token_fee ?? 0n,
    nativeFee: fee.native_token_fee ?? 0n,
    usdFee: typeof fee.usd_fee === "number" ? fee.usd_fee : null,
  };
}

/**
 * The amount that will actually land, or null when nothing can.
 *
 * Worth having as one function because the two failure modes are easy to
 * conflate. An amount at or below the fee is a dead transfer, and a result that
 * truncates to zero once re-based onto the destination's decimals is equally
 * dead — the second is easy to hit when bridging a low-decimal token from a
 * high-decimal chain, where a real-looking amount becomes dust in transit.
 */
export function netAfterFee(
  amount: bigint,
  fee: bigint,
  rebase: (value: bigint) => bigint,
): bigint | null {
  if (amount <= fee) return null;
  const net = rebase(amount - fee);
  return net > 0n ? net : null;
}
