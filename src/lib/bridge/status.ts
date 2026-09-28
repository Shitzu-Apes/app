import type { Chain } from "omni-bridge-sdk";

import { OMNI_API_BASE_URL } from "./omni";

/**
 * Transfer reads that bypass `omni-bridge-sdk`'s response validation.
 *
 * The SDK declares `id` as `{ origin_chain, kind: { Nonce } }`, but the live API
 * returns `{ origin_chain, origin_nonce }`. Every schema-validated read therefore
 * throws a ZodError against production, which is why transfer progress could
 * never be shown. These helpers read the documented endpoints directly and
 * tolerate both shapes, so a future SDK fix cannot silently break them again.
 */

export type RawTransferId = {
  origin_chain: Chain;
  origin_nonce?: number;
  kind?: { Nonce?: number };
};

export type RawTransfer = {
  id: RawTransferId | null;
  initialized: unknown;
  signed: unknown;
  fast_finalised_on_near: unknown;
  finalised_on_near: unknown;
  fast_finalised: unknown;
  finalised: unknown;
  claimed: unknown;
  transfer_message: {
    token: string;
    amount: string;
    sender: string;
    recipient: string;
    fee?: { fee?: string; native_fee?: string };
  } | null;
};

/** Statuses after which no further progress is expected. */
export const TERMINAL_STATUSES = [
  "Finalised",
  "Claimed",
  "FastFinalised",
  "FinalisedOnNear",
  "FastFinalisedOnNear",
] as const;

export type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

/** Stable identity for a transfer, whichever id shape the API used. */
export function getTransferKey(transfer: {
  id?: RawTransferId | null;
}): string {
  return `${transfer.id?.origin_chain}:${getTransferNonce(transfer)}`;
}

/** Nonce from either id shape. Returns undefined rather than lying with NaN. */
export function getTransferNonce(transfer: {
  id?: RawTransferId | null;
}): number | undefined {
  return transfer.id?.origin_nonce ?? transfer.id?.kind?.Nonce;
}

/**
 * An Omni API error, carrying the status so callers can tell the kinds apart.
 *
 * The distinction matters, and getting it wrong kills a working transfer. A 404 from
 * an indexer means "not there *yet*", not "does not exist": a deposit signed a moment
 * ago is not in the index and will be within seconds. Treating that as a permanent
 * answer failed a real bridge mid-flight — the funds were on their way and the app
 * said the bridge did not recognise them.
 */
export class OmniApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
  ) {
    super(`Omni API ${path} failed (${status})`);
    this.name = "OmniApiError";
  }

  /**
   * The lookup itself is wrong, so asking again cannot help.
   *
   * A 400 means the API rejected the request — a nonce that is not a number, say.
   * Nothing about waiting changes that, so it is the one status worth failing on
   * immediately.
   */
  get isMalformed(): boolean {
    return this.status === 400;
  }

  /**
   * The transfer is not indexed yet, which is the ordinary state right after signing.
   *
   * Kept separate from `isMalformed` because the two call for opposite behaviour: this
   * one is the reason the index phase exists at all, and the answer to it is to keep
   * asking.
   */
  get isNotIndexed(): boolean {
    return this.status === 404;
  }
}

async function apiGet<T>(path: string, params: Record<string, string>) {
  const url = new URL(`${OMNI_API_BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url);
  if (!res.ok) {
    throw new OmniApiError(res.status, path);
  }
  return (await res.json()) as T;
}

/** Look up a transfer by either the origin or destination transaction hash. */
export async function fetchTransferByTxHash(
  txHash: string,
): Promise<RawTransfer | undefined> {
  const all = await apiGet<RawTransfer[]>("/api/v2/transfers/transfer", {
    transaction_hash: txHash,
  });
  return all[0];
}

export async function fetchTransferByNonce(
  originChain: Chain,
  originNonce: number,
): Promise<RawTransfer | undefined> {
  const all = await apiGet<RawTransfer[]>("/api/v2/transfers/transfer", {
    origin_chain: originChain,
    origin_nonce: String(originNonce),
  });
  return all[0];
}

export async function fetchTransferStatuses(txHash: string): Promise<string[]> {
  return apiGet<string[]>("/api/v2/transfers/transfer/status", {
    transaction_hash: txHash,
  });
}

/** The API rejects a `limit` above this. */
export const MAX_PAGE_SIZE = 50;

/**
 * Every transfer this sender has made, oldest first.
 *
 * The API returns ascending by nonce and caps `limit` at 50, so asking for a
 * small page silently returns the *oldest* transfers and hides the newest ones
 * — which is exactly what a "did my deposit land?" check needs to see. Page
 * until exhausted so nothing is dropped.
 */
export async function fetchTransfersBySender(
  sender: string,
  options: { maxPages?: number; pageSize?: number } = {},
): Promise<RawTransfer[]> {
  const pageSize = Math.min(options.pageSize ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE);
  const maxPages = options.maxPages ?? 10;

  const all: RawTransfer[] = [];
  for (let page = 0; page < maxPages; page++) {
    const batch = await apiGet<RawTransfer[]>("/api/v2/transfers", {
      sender,
      limit: String(pageSize),
      offset: String(page * pageSize),
    });
    all.push(...batch);
    // A short (or empty) page means we have reached the end.
    if (batch.length < pageSize) break;
  }
  return all;
}

/** The most recent `count` transfers, newest first. */
export async function fetchRecentTransfersBySender(
  sender: string,
  count: number,
  options?: { maxPages?: number },
): Promise<RawTransfer[]> {
  const all = await fetchTransfersBySender(sender, options);
  return all.slice(-count).reverse();
}

export function isTerminal(statuses: string[]): boolean {
  return statuses.some((s) =>
    (TERMINAL_STATUSES as readonly string[]).includes(s),
  );
}

/** Coarse phase for the UI, derived from which receipts exist. */
export type BridgePhase =
  | "submitted"
  | "confirmed"
  | "finalising"
  | "finalised";

export function phaseOf(transfer: RawTransfer): BridgePhase {
  if (transfer.finalised || transfer.claimed) return "finalised";
  if (
    transfer.fast_finalised ||
    transfer.finalised_on_near ||
    transfer.fast_finalised_on_near
  ) {
    return "finalising";
  }
  if (transfer.initialized || transfer.signed) return "confirmed";
  return "submitted";
}

export type WaitOptions = {
  /** Solana signature or destination tx hash of the deposit. */
  txHash?: string;
  /**
   * Where a NEAR deposit is identified instead.
   *
   * A NEAR deposit hands back the transfer message rather than a transaction
   * hash, and the native panel has always found it by its origin nonce. Polling
   * the bridge's own API for that is the point: it reports the transfer's real
   * phase — submitted, confirmed, finalising, finalised — instead of inferring
   * arrival from a balance, and it is a single endpoint that answers for either
   * chain. The nonce is known at signing, so there is nothing to wait to be
   * indexed before the finalise loop can start.
   */
  origin?: { chain: Chain; nonce: number };
  onPhase?: (phase: BridgePhase, attempt: number, total: number) => void;
  /** Total time to wait for the transfer to be indexed. */
  indexTimeoutMs?: number;
  /** Total time to wait for a terminal status once indexed. */
  finaliseTimeoutMs?: number;
  intervalMs?: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Poll until the deposit is indexed and then until it reaches a terminal state.
 *
 * Indexing lags the chain by a few blocks, and the Near leg finalises a little
 * later again, so both phases are polled separately and reported distinctly.
 */
export async function waitForTransfer({
  txHash,
  origin,
  onPhase,
  indexTimeoutMs = 90_000,
  finaliseTimeoutMs = 180_000,
  intervalMs = 3_000,
}: WaitOptions): Promise<RawTransfer> {
  const indexAttempts = Math.ceil(indexTimeoutMs / intervalMs);

  let transfer: RawTransfer | undefined;
  // Whether every attempt so far has been a 404, which changes what the timeout can
  // honestly claim. "The bridge has not indexed it" is a statement about the index; if
  // the reads were failing some other way it is a statement about the API, and saying
  // the index is behind when the API is down sends the user to the wrong place.
  let onlyNotIndexed = true;
  for (let attempt = 1; attempt <= indexAttempts; attempt++) {
    onPhase?.("submitted", attempt, indexAttempts);
    // A NEAR deposit is located by its nonce, so the first read is the one that
    // finds it; there is no hash to wait for an indexer to catch up with.
    if (attempt > 1) await sleep(intervalMs);
    try {
      transfer = origin
        ? await fetchTransferByNonce(origin.chain, origin.nonce)
        : txHash
          ? await fetchTransferByTxHash(txHash)
          : undefined;
      if (transfer?.id) break;
    } catch (err) {
      // A 404 is the bridge not having indexed the transfer yet, which for a deposit
      // signed seconds ago is the *expected* answer rather than a refusal — measured
      // live: the same lookup 404s immediately and resolves about a second later. So it
      // is kept polling, and the index phase's own timeout is what distinguishes
      // "still indexing" from "the bridge never heard of it".
      if (err instanceof OmniApiError && err.isMalformed) {
        throw new Error(
          "The bridge rejected the lookup for this transfer, so it cannot be tracked. If the deposit was accepted your funds are on their way — check your destination account in a few minutes.",
        );
      }
      if (!(err instanceof OmniApiError && err.isNotIndexed))
        onlyNotIndexed = false;
      // keep polling; the indexer can lag or briefly fail
    }
  }

  if (!transfer?.id) {
    throw new Error(
      onlyNotIndexed
        ? "Submitted, but the bridge has not indexed it yet. Your funds are safe — check your NEAR account in a minute."
        : "Submitted, but the bridge could not be read just now. Your funds are safe — check your NEAR account in a minute.",
    );
  }

  // Narrowed once so the nonce is available for the follow-up reads below.
  const originChain = transfer.id.origin_chain;
  const originNonce = getTransferNonce(transfer);
  if (originNonce == null) {
    throw new Error(
      "The bridge indexed this transfer without a nonce. Check your NEAR account shortly.",
    );
  }

  const finaliseAttempts = Math.ceil(finaliseTimeoutMs / intervalMs);
  for (let attempt = 1; attempt <= finaliseAttempts; attempt++) {
    onPhase?.(phaseOf(transfer), attempt, finaliseAttempts);
    if (phaseOf(transfer) === "finalised") return transfer;
    await sleep(intervalMs);
    try {
      const next = await fetchTransferByNonce(originChain, originNonce);
      if (next) transfer = next;
    } catch {
      // keep polling
    }
  }

  // Indexed but not terminal: report what we know rather than failing.
  onPhase?.(phaseOf(transfer), finaliseAttempts, finaliseAttempts);
  return transfer;
}
