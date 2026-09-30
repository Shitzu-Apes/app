import { rpcFetch } from "./rpc-retry";

/**
 * How much a swap actually delivered, read from the transaction itself.
 *
 * Asking the balance "what did you gain?" is the wrong question. It cannot say
 * *which* transaction produced the gain, so it has to be sampled either side of the
 * swap, and the two samples race anything else that moves the same balance — and it
 * says nothing about *what form* the tokens arrived in, which is the part that
 * matters here.
 *
 * That is not hypothetical. The bridge is asymmetric: a swap out of a NEAR account
 * can deliver wrapped NEAR or native NEAR depending on the venue's route, and
 * sampling `wrap.near` around a swap that delivered native NEAR reports a delta of
 * exactly zero. Which is what happened — a successful swap reported as having
 * delivered nothing.
 *
 * The transaction's own logs say what moved and in what form, attributed to that
 * transaction and nothing else. Two event shapes matter:
 *
 *   Transfer       {"old_account_id", "new_account_id", "amount"}   native NEAR
 *   ft_transfer    {"old_owner_id", "new_owner_id", "token_id", ...}  NEP-141
 *
 * In both, the account that received is the one the swap credited, and the venue's
 * own intermediate transfers name the pool rather than the user, so they do not
 * match.
 */

export type Received = {
  /** In the token's own base units. */
  amount: bigint;
  /** `near` for native, or the NEP-141 contract id. */
  tokenId: string;
  /** True for native NEAR, which is not a NEP-141 and has no decimals to declare. */
  native: boolean;
};

/**
 * A NEAR failure body.
 *
 * Two shapes, and the nesting is not optional. An action failure wraps its cause:
 *
 *   { ActionError: { index, kind: { FunctionCallError: { ExecutionError } } } }
 *
 * while a bare execution failure puts the kind at the top. Reading only the second
 * finds a reason sometimes, and silently reports "the transaction reverted" the rest
 * of the time — which is how the panic message gets lost.
 */
type FailureBody = {
  index?: number;
  kind?: { FunctionCallError?: { ExecutionError?: string } };
  ActionError?: {
    index?: number;
    kind?: { FunctionCallError?: { ExecutionError?: string } };
  };
};

/** Anything a receipt or a transaction can say about how it went. */
type OutcomeStatus = Record<string, FailureBody | string>;

type TxResponse = {
  transaction?: { hash?: string };
  status?: OutcomeStatus;
  receipts_outcome?: {
    id?: string;
    outcome?: { logs?: string[]; status?: OutcomeStatus };
  }[];
  transaction_outcome?: {
    outcome?: { logs?: string[]; status?: OutcomeStatus };
  };
};

/**
 * Why a transaction reverted, if it did.
 *
 * This is not a consolation prize for missing logs — with a reverting call it is
 * usually the *only* evidence there is. A contract call that panics emits no events,
 * so a failed swap has an empty log list, and a reader that only parses logs
 * concludes the swap delivered nothing. It delivered nothing *because it failed*, and
 * the reason is right here:
 *
 *   Failure: Smart contract panicked: The account doesn't have enough balance
 *
 * Which is a different thing to tell a user from "nothing arrived", and the
 * difference is whether they should retry or go looking for their tokens.
 */
export function revertReason(tx: {
  status?: OutcomeStatus;
  receipts_outcome?: { outcome?: { status?: OutcomeStatus } }[];
}): string | undefined {
  const read = (status?: OutcomeStatus): string | undefined => {
    if (!status) return undefined;
    const failure = status.Failure;
    if (!failure || typeof failure === "string") return undefined;
    const message =
      failure.kind?.FunctionCallError?.ExecutionError ??
      failure.ActionError?.kind?.FunctionCallError?.ExecutionError;
    return typeof message === "string" && message.length > 0
      ? message
      : "the transaction reverted";
  };

  return (
    read(tx.status) ??
    (tx.receipts_outcome ?? [])
      .map((receipt) => read(receipt.outcome?.status))
      .find(Boolean)
  );
}

/**
 * The NEAR node to read the transaction from.
 *
 * Overridable so the log parsing — the part with real shapes to get wrong — can be
 * tested without a node, and so a future second node does not mean threading a
 * parameter through every caller. `import.meta.env` is not readable outside a
 * bundler.
 */
let nodeUrlOverride: string | undefined;

export function setNodeUrlForReads(url: string | undefined): void {
  nodeUrlOverride = url;
}

function nodeUrl(): string {
  if (nodeUrlOverride) return nodeUrlOverride;
  return (import.meta.env?.VITE_NODE_URL as string | undefined) ?? "";
}

/**
 * Everything the account received in one transaction.
 *
 * Native and NEP-141 receipts are kept apart rather than summed: they are different
 * tokens, and adding them would produce a number that belongs to nothing.
 */
export async function receivedInTransaction(
  txHash: string,
  accountId: string,
): Promise<{
  native: Received | null;
  tokens: Map<string, Received>;
  /** Set when the transaction itself reverted, which is why nothing arrived. */
  reverted?: string;
}> {
  // The second parameter is the *sender's account id*, a string. Passing a boolean
  // is a parse error and the node answers 400 — so this read failed on the shape of
  // the request rather than anything to do with the transaction.
  const tx = await rpcFetch<TxResponse>(nodeUrl(), {
    method: "tx",
    params: [txHash, accountId],
  });

  const logs = [
    ...(tx.transaction_outcome?.outcome?.logs ?? []),
    ...(tx.receipts_outcome ?? []).flatMap(
      (receipt) => receipt.outcome?.logs ?? [],
    ),
  ];

  let native: Received | null = null;
  const tokens = new Map<string, Received>();

  for (const log of logs) {
    // The account matters and is not optional here. A swap moves tokens through the
    // pool on the way, and those receipts have the same shape as the one that
    // credited the user — so without the filter the venue's own intermediate hops are
    // counted as the user's output, and the total is larger than anything they were
    // ever going to receive.
    const event = parseEvent(log, accountId) as Parsed | null;
    if (!event) continue;
    const amount = BigInt(event.amount);
    if (amount <= 0n) continue;

    if (event.kind === "native") {
      // Read through a local, annotated: `native` is narrowed to null at this point
      // in the statement, so `native?.amount` types as `never`, and a bare local
      // would then be inferred circularly from the assignment below.
      const prior: bigint = native === null ? 0n : native.amount;
      native = {
        amount: prior + amount,
        tokenId: "near",
        native: true,
      };
      continue;
    }
    const key = event.tokenId;
    const existing = tokens.get(key);
    tokens.set(key, {
      amount: (existing?.amount ?? 0n) + amount,
      tokenId: key,
      native: false,
    });
  }

  return { native, tokens, reverted: revertReason(tx) };
}

export type Parsed =
  | { kind: "native"; amount: string }
  | { kind: "token"; amount: string; tokenId: string };

/**
 * One receipt event, if it is a transfer that credited `accountId`.
 *
 * Exported for testing against real log lines, which are the whole point — the
 * shapes differ between contract versions and getting them wrong is silent.
 */
export function parseEvent(log: string, accountId?: string): Parsed | null {
  // Only transfer events carry an amount, and looking for the marker first avoids
  // parsing every unrelated line a swap emits.
  const isFt = log.startsWith('{"event_type":"ft_transfer"');
  if (!isFt && !log.startsWith('{"event_type":"transfer"')) return null;
  let event: {
    event_type?: string;
    amount?: string;
    token_id?: string;
    new_owner_id?: string;
    new_account_id?: string;
  };
  try {
    event = JSON.parse(log);
  } catch {
    return null;
  }
  if (typeof event.amount !== "string") return null;

  if (isFt) {
    if (!event.token_id) return null;
    if (accountId && event.new_owner_id !== accountId) return null;
    return { kind: "token", amount: event.amount, tokenId: event.token_id };
  }
  if (accountId && event.new_account_id !== accountId) return null;
  return { kind: "native", amount: event.amount };
}

/**
 * A NEAR read, in the shape the node accepts.
 *
 * Every account read is a *query*, and this is the only shape in which the node
 * serves one:
 *
 *   { method: "query", params: { request_type, finality, ... } }
 *
 * Asking for `view_account` or `call_function` as a method of its own returns
 * METHOD_NOT_FOUND, which looks exactly like a broken node and is not one. The two
 * readers below are the whole reason this helper exists — they are the only account
 * reads in the bridge, and there is no reason for them to disagree about this.
 */
function query(
  request: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return rpcFetch<Record<string, unknown>>(nodeUrl(), {
    method: "query",
    params: { finality: "final", ...request },
  });
}

/**
 * Native NEAR held, in yoctoNEAR.
 *
 * A failure is an error rather than zero. This is a *baseline for a difference*, and
 * quietly substituting zero for an unreadable node turns a failed read into a
 * fabricated gain or loss — the caller can tell the difference, so it is told.
 */
export async function nativeBalanceOf(accountId: string): Promise<bigint> {
  const account = await query({
    request_type: "view_account",
    account_id: accountId,
  });
  if (!account?.amount) {
    throw new Error("the node did not report a native NEAR balance");
  }
  return BigInt(String(account.amount));
}

/**
 * A NEP-141 balance, in base units.
 *
 * `ft_balance_of` reverts for an account that has never registered for the token,
 * which is the normal state before a first swap into it. That is not a failure of
 * the read, it *is* the answer — zero — and the caller needs the difference to be
 * right in the case that matters most: a first swap into a token you hold none of.
 */
export async function tokenBalanceOf(
  tokenId: string,
  accountId: string,
): Promise<bigint> {
  try {
    const view = await query({
      request_type: "call_function",
      account_id: tokenId,
      method_name: "ft_balance_of",
      args_base64: btoa(JSON.stringify({ account_id: accountId })),
    });
    const bytes = view?.result;
    if (!Array.isArray(bytes)) return 0n;
    const decoded = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes)));
    return decoded ? BigInt(String(decoded)) : 0n;
  } catch {
    return 0n;
  }
}

/**
 * Whether the account is registered for a NEP-141, i.e. whether it has a storage
 * balance.
 *
 * The bridge's own deposit needs the *wrapped* form of NEAR, so before signing it
 * has to know whether the account can hold the wrapped form at all: an account that
 * has never touched `wrap.near` has no storage balance, so a `near_deposit` is not
 * enough on its own and a storage deposit has to precede it. `null` from the
 * contract is the honest answer for "never registered" — it is an answer, not a
 * failure of the read.
 *
 * An unreadable node is treated as unregistered on purpose. That is the safe
 * direction: the worst case is a small storage deposit on an account that already
 * had one, which stays in the account, while the other assumption signs a
 * `near_deposit` that the contract may reject outright.
 */
export async function ftStorageRegistered(
  tokenId: string,
  accountId: string,
): Promise<boolean> {
  try {
    const view = await query({
      request_type: "call_function",
      account_id: tokenId,
      method_name: "storage_balance_of",
      args_base64: btoa(JSON.stringify({ account_id: accountId })),
    });
    const bytes = view?.result;
    if (!Array.isArray(bytes)) return false;
    const decoded = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes)));
    return decoded !== null && decoded !== undefined;
  } catch {
    return false;
  }
}

/**
 * The NEP-145 minimum storage balance, in base units.
 *
 * Read rather than assumed so the figure is the contract's own, and thrown rather
 * than defaulted to zero: a zero attached to a registration that needs one would
 * fail the whole batch at signing, and the caller has no sensible value to fall
 * back on. By the time this is called the caller has already decided a storage
 * deposit is needed, so there is nothing to do but ask.
 */
export async function ftStorageMin(tokenId: string): Promise<bigint> {
  const view = await query({
    request_type: "call_function",
    account_id: tokenId,
    method_name: "storage_balance_bounds",
    args_base64: btoa("{}"),
  });
  const bytes = view?.result;
  if (!Array.isArray(bytes)) {
    throw new Error("the node did not report a storage balance bound");
  }
  const decoded = JSON.parse(
    new TextDecoder().decode(new Uint8Array(bytes)),
  ) as { min?: string } | null;
  if (decoded?.min == null) {
    throw new Error("the token did not report a minimum storage balance");
  }
  return BigInt(String(decoded.min));
}

/**
 * What one of the user's own tokens gained in a transaction, or null if it cannot be
 * read.
 *
 * Narrower than `receivedInTransaction` on purpose: this answers a single question —
 * did *this* token arrive, and how much — for a caller that has already signed and
 * needs a measured figure rather than a predicted one. Returns null rather than zero,
 * because "the logs could not be read" and "nothing arrived" call for different
 * sentences, and a caller that cannot tell them apart will eventually print zero as
 * though it were an amount.
 *
 * Native NEAR is reported as a loss rather than excluded: a swap that delivers native
 * has unwrapped on the way, and that unwrap is a debit against the wrapped balance
 * which would otherwise read as a negative delivery. Null in that case, because the
 * wrapped figure is not the amount that arrived.
 */
export async function deliveredBySwap(
  txHash: string,
  tokenId: string,
  accountId: string,
): Promise<bigint | null> {
  try {
    const { native, tokens } = await receivedInTransaction(txHash, accountId);
    if (tokenId === "near") {
      // Delivered natively: the wrapped contract was debited to make that happen, so
      // there is no wrapped credit to read and reporting the debit would be worse than
      // reporting nothing.
      if (native && native.amount > 0n) return null;
      return null;
    }
    return tokens.get(tokenId)?.amount ?? null;
  } catch {
    return null;
  }
}
