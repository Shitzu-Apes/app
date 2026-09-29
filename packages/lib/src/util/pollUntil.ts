export interface PollUntilOptions<T> {
  /** Reads the current value. A rejection is a failed poll, not a failure. */
  tick: () => Promise<T>;
  /** Whether the polled value satisfies the wait. */
  isDone: (value: T) => boolean;
  /** Receives every successfully polled value. */
  onValue?: (value: T) => void;
  /** Receives the error of every failed poll. */
  onError?: (error: unknown) => void;
  /** Wait before polling again after a value that is not done. */
  refetchDelay: number;
  /** Wait before resolving once the value is done. */
  finalDelay: number;
}

/**
 * Polls `tick` until `isDone`, then resolves.
 *
 * A rejected `tick` is reported to `onError` and the poll is retried: the
 * returned promise deliberately stays pending rather than rejecting, because a
 * transient failure (a rate-limited RPC, a flaky indexer) must not abandon a
 * wait that is otherwise still making progress. Building this on
 * `new Promise(asyncExecutor)` would instead leak the rejection as an
 * unhandled rejection and never settle the promise at all.
 */
export function pollUntil<T>(opts: PollUntilOptions<T>): Promise<void> {
  const { tick, isDone, onValue, onError, refetchDelay, finalDelay } = opts;

  return new Promise<void>((resolve) => {
    const poll = async () => {
      try {
        const value = await tick();
        onValue?.(value);
        if (isDone(value)) {
          setTimeout(resolve, finalDelay);
          return;
        }
      } catch (error: unknown) {
        onError?.(error);
      }
      setTimeout(poll, refetchDelay);
    };
    poll();
  });
}
