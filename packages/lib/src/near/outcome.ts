/**
 * The parts of a NEAR execution outcome that decide whether it worked.
 *
 * Structural rather than imported, because the shape differs between wallets and
 * between `@near-js` versions, and every field is optional in practice. What
 * matters is that all three failure signals are readable.
 */
export type NearTxOutcome = {
  status?: unknown;
  transaction_outcome?: { id?: string; outcome?: { logs?: string[] } };
  receipts_outcome?: { id?: string; outcome?: { logs?: string[] } }[];
};

export function isFailureSignal(value: unknown): boolean {
  return (
    value === "Failure" ||
    (typeof value === "object" &&
      value !== null &&
      "Failure" in value &&
      Boolean((value as { Failure?: unknown }).Failure))
  );
}

/** Whether any part of this outcome reports a failure. */
export function isReverted(outcome: NearTxOutcome | undefined): boolean {
  if (!outcome) return false;
  return (
    isFailureSignal(outcome.status) ||
    isFailureSignal(outcome.transaction_outcome?.id) ||
    (outcome.receipts_outcome ?? []).some((receipt) =>
      isFailureSignal(receipt.id),
    )
  );
}

/** The revert reason, from whichever receipt carries it. Only it says *why*. */
export function revertLog(
  outcome: NearTxOutcome | undefined,
): string | undefined {
  return (
    (outcome?.receipts_outcome ?? []).find((receipt) =>
      isFailureSignal(receipt.id),
    )?.outcome?.logs?.[0] ?? outcome?.transaction_outcome?.outcome?.logs?.[0]
  );
}
