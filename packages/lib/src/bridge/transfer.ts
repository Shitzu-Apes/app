import { rebaseAmount } from "./amount";
import { getBridgeFee, netAfterFee, type BridgeFee } from "./fee";
import type { Rail } from "./rail";
import type { RoutePlan } from "./search";

import type { Network } from "$lib/models/tokens";

/**
 * The shared shape of both transfer directions.
 *
 * A route is three legs and the middle one is the bridge, but which chain the
 * user signs on depends on where they started. Solana sources are two wallet
 * prompts on the same wallet and then a wait; NEAR sources can be a single
 * transaction. What both have in common is the ordering that must not be got
 * wrong, and that is what lives here rather than in either executor.
 */

export type TransferLeg = "swap" | "bridge" | "convert";

export type TransferProgress = {
  leg: TransferLeg;
  message: string;
};

export class TransferError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "TransferError";
  }
}

export type PreparedDeposit = {
  /** What is handed to the bridge, in the rail's source-chain base units. */
  amount: bigint;
  fee: BridgeFee;
  /** What lands on the destination chain before any final swap, re-based. */
  arrivedAmount: bigint;
};

/**
 * Work out what to deposit, and refuse the ones that cannot land.
 *
 * The fee is quoted on the post-swap amount rather than on what the user typed,
 * because that is what the bridge will actually be handed. Quoting it earlier
 * understates it for every route that swaps first, and the deposit would then be
 * rejected by the contract after the user had already signed for the swap.
 */
/**
 * The rail a bridged plan carries, or a thrown error.
 *
 * Every function that touches the bridge goes through this rather than reading
 * `plan.rail` directly. A same-chain swap has no rail, and reaching one here would
 * otherwise be a null dereference deep inside a fee quote — reported as a
 * mysterious network error rather than as "this route is not a bridge".
 */
export function railOf(plan: RoutePlan): Rail {
  if (!plan.rail) {
    throw new TransferError(
      "That route does not cross the bridge, so it has no deposit",
    );
  }
  return plan.rail;
}

export async function prepareDeposit(
  plan: RoutePlan,
  {
    from,
    to,
    sender,
    recipient,
    amount,
  }: {
    from: Network;
    to: Network;
    sender: string;
    recipient: string;
    /** The post-swap amount, in the rail's source-chain base units. */
    amount: bigint;
  },
): Promise<PreparedDeposit> {
  const rail = railOf(plan);
  if (amount <= 0n) {
    throw new TransferError("That amount is too small to bridge");
  }

  const fee = await getBridgeFee({
    from,
    to,
    sender,
    recipient,
    tokenAddress: rail.sourceAddress,
    amount,
  });

  const arrivedAmount = netAfterFee(amount, fee.tokenFee, (value) =>
    rebaseAmount(value, rail.sourceDecimals, rail.destDecimals),
  );

  if (arrivedAmount === null) {
    throw new TransferError("That amount is too small to cover the bridge fee");
  }

  return { amount, fee, arrivedAmount };
}

/** Human-readable legs, so the button can say what is happening. */
export function progressFor(plan: RoutePlan, leg: TransferLeg): string {
  const rail = plan.rail?.symbol;
  const target = plan.targetSymbol;
  if (leg === "bridge" && rail) return `Bridging ${rail}…`;
  return leg === "swap"
    ? `Swapping ${plan.sourceSymbol} → ${rail ?? target}…`
    : `Converting into ${target}…`;
}
