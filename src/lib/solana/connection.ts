import {
  Connection,
  type BlockheightBasedTransactionConfirmationStrategy,
  type Commitment,
  type TransactionConfirmationStrategy,
} from "@solana/web3.js";
import bs58 from "bs58";

/**
 * A transaction signature decodes to exactly 64 bytes; a legacy blockhash is 32.
 * Decoding is used rather than a length check because base58 length does not
 * map to byte length.
 */
export function isSignature(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    return bs58.decode(value).length === 64;
  } catch {
    return false;
  }
}

export type SignatureStatusLike = {
  err: unknown;
  confirmationStatus: "processed" | "confirmed" | "finalized" | null;
} | null;

export type StatusResult = {
  context: { slot: number };
  value: { err: unknown } | null;
};

export type PollOptions = {
  /** Overall budget. A pruned or unknown signature must not spin forever. */
  timeoutMs?: number;
  firstDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Confirm a signature using nothing but `getSignatureStatuses`.
 *
 * Polls with a backoff and gives up at the budget, reporting web3.js's
 * `transactionExpired` so callers still get a normal error rather than a hang.
 *
 * Note the statuses the cluster reports are pruned as the chain advances, so a
 * signature old enough to be evicted reports `null` forever. That is
 * indistinguishable from "not landed yet", which is why the budget is bounded.
 */
export async function pollSignatureStatus(
  getStatuses: (
    signature: string,
  ) => Promise<{ context: { slot: number }; value: unknown[] }>,
  signature: string,
  want: Commitment,
  options: PollOptions = {},
): Promise<StatusResult> {
  const {
    timeoutMs = 30_000,
    firstDelayMs = 400,
    maxDelayMs = 2_000,
    sleep = defaultSleep,
  } = options;

  const deadline = Date.now() + timeoutMs;
  let delay = firstDelayMs;

  for (;;) {
    const res = await getStatuses(signature);
    const status = res.value[0] as SignatureStatusLike;

    if (status) {
      if (status.err) {
        return {
          context: { slot: res.context.slot },
          value: { err: status.err },
        };
      }
      const reached =
        want === "processed" ||
        status.confirmationStatus === "confirmed" ||
        status.confirmationStatus === "finalized";
      if (reached) {
        return { context: { slot: res.context.slot }, value: { err: null } };
      }
    }

    if (Date.now() >= deadline) {
      return {
        context: { slot: res.context.slot },
        value: { err: { transactionExpired: true } },
      };
    }

    await sleep(delay);
    delay = Math.min(Math.round(delay * 1.4), maxDelayMs);
  }
}

/**
 * A Connection whose `confirmTransaction` never opens a websocket.
 *
 * web3.js confirms a signature by opening a signature-subscribe websocket. The
 * public cluster RPC rejects that from a browser origin, so the call never
 * resolves and web3.js retries in a loop, spamming the console with a JSON-RPC
 * error while never completing. Measured on mainnet, `confirmTransaction` was
 * still hanging after 8s where a `getSignatureStatuses` round trip took ~100ms.
 *
 * `omni-bridge-sdk` reaches Solana through Anchor, whose `rpc()` calls
 * `connection.confirmTransaction` directly, so replacing that one method here
 * fixes every confirm in the app without patching the SDK.
 *
 * The result is a real `Connection` with a single method swapped, so it stays
 * assignable anywhere a `Connection` is expected.
 */
export function createHttpConfirmConnection(
  endpoint: string,
  commitment?: Commitment,
  pollOptions?: PollOptions,
): Connection {
  const connection = new Connection(endpoint, commitment);

  connection.confirmTransaction = (async (
    strategy: string | TransactionConfirmationStrategy,
    commitmentOrConfig?: Commitment | TransactionConfirmationStrategy,
  ) => {
    if (!isSignature(strategy)) {
      // Legacy (blockhash | blockheight strategy) form: unused in this app, so
      // defer to the original implementation.
      return await (
        Connection.prototype.confirmTransaction as unknown as (
          s: TransactionConfirmationStrategy,
          c?: Commitment,
        ) => Promise<unknown>
      ).call(
        connection,
        strategy as TransactionConfirmationStrategy,
        commitmentOrConfig as Commitment,
      );
    }

    const config = commitmentOrConfig;
    const want: Commitment =
      typeof config === "string"
        ? config
        : config && "commitment" in config
          ? ((config as { commitment: Commitment }).commitment ?? "confirmed")
          : "confirmed";

    return pollSignatureStatus(
      (sig) => connection.getSignatureStatuses([sig]),
      strategy,
      want,
      pollOptions,
    );
  }) as Connection["confirmTransaction"];

  return connection;
}

export type { BlockheightBasedTransactionConfirmationStrategy };
