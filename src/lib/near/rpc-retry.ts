const MAX_RETRIES = 3;
const BASE_DELAY = 1_000;

export interface JsonRpcRequest {
  method: string;
  params: unknown;
}

export interface RpcFetchOptions {
  maxRetries?: number;
  baseDelay?: number;
}

export function linearBackoff(
  attempt: number,
  baseDelay: number = BASE_DELAY,
): number {
  return baseDelay * (attempt + 1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function describeRpcError(error: {
  data?: unknown;
  message?: unknown;
}): string {
  const detail = error.data ?? error.message;
  if (typeof detail === "string") return detail;
  return JSON.stringify(detail ?? error);
}

/** Thrown when the node answered with a JSON-RPC `error` instead of a result. */
export class RpcResponseError extends Error {
  readonly detail: { data?: unknown; message?: unknown };

  constructor(detail: { data?: unknown; message?: unknown }) {
    super(describeRpcError(detail));
    this.name = "RpcResponseError";
    this.detail = detail;
  }
}

export async function rpcFetch<T>(
  node: string,
  request: JsonRpcRequest,
  opts: RpcFetchOptions = {},
): Promise<T> {
  const maxRetries = opts.maxRetries ?? MAX_RETRIES;
  const baseDelay = opts.baseDelay ?? BASE_DELAY;

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(node, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "dontcare",
        ...request,
      }),
    });

    // Only 429 is retried; every other failure surfaces on the first attempt.
    if (res.status === 429 && attempt < maxRetries) {
      const delay = linearBackoff(attempt, baseDelay);
      console.warn(
        `[rpc]: 429 from ${node}, retrying in ${delay}ms (${attempt + 1}/${maxRetries})`,
      );
      await sleep(delay);
      continue;
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const json = (await res.json()) as {
      result?: T;
      error?: { data?: unknown; message?: unknown };
    };
    if (json.error) {
      console.error("[rpc]: Error", json.error.data);
      throw new RpcResponseError(json.error);
    }

    return json.result as T;
  }
}
