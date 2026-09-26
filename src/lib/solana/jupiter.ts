import { PublicKey, VersionedTransaction } from "@solana/web3.js";

/** Jupiter's public quote/swap API. No API key required, CORS-enabled. */
const JUPITER_API = "https://lite-api.jup.ag";

export const WSOL_MINT = "So11111111111111111111111111111111111111112";
export const WNEAR_MINT = "3ZLekZYq2qkZiSpnSvabjit34tUkjSwD1JFuW9as9wBG";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export type JupiterRouteStep = {
  swapInfo: {
    ammKey: string;
    label: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
  };
  percent: number;
};

export type JupiterQuote = {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: JupiterRouteStep[];
  /** Base64 swap transaction, only present on swap requests. */
  swapTransaction?: string;
};

export type SwapToken = {
  mint: string;
  symbol: string;
  decimals: number;
  icon?: string;
};

/** Source tokens offered by the Solana -> NEAR bridge flow. */
export const SWAP_TOKENS: Record<string, SwapToken> = {
  SOL: { mint: WSOL_MINT, symbol: "SOL", decimals: 9 },
  // Display symbol is plain "NEAR": users should not have to know the bridged
  // token is the wrapped representation. The mint is the real wNEAR SPL token.
  WNEAR: { mint: WNEAR_MINT, symbol: "NEAR", decimals: 9 },
  USDC: { mint: USDC_MINT, symbol: "USDC", decimals: 6 },
};

export class JupiterError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** Jupiter's machine-readable code, absent for malformed requests. */
    readonly errorCode?: string,
  ) {
    super(message);
    this.name = "JupiterError";
  }

  /**
   * True when the failure means "this pair cannot be swapped" rather than
   * "the request was wrong". The UI shows these as unavailable instead of an
   * error toast.
   */
  get isUnavailable(): boolean {
    return this.status === 404 || this.errorCode !== undefined;
  }
}

async function jupiterFetch<T>(path: string, params: Record<string, string>) {
  const url = new URL(`${JUPITER_API}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // Jupiter reports availability problems (TOKEN_NOT_TRADABLE, no route) as
    // 400s carrying an errorCode, while malformed requests carry only `error`.
    let errorCode: string | undefined;
    try {
      errorCode = JSON.parse(body).errorCode;
    } catch {
      // non-JSON error body
    }
    throw new JupiterError(
      `Jupiter ${path} failed (${res.status}): ${body.slice(0, 200)}`,
      res.status,
      errorCode,
    );
  }
  return (await res.json()) as T;
}

/**
 * Quote a swap. Returns null when Jupiter has no route for the pair, which the
 * UI should treat as "unavailable" rather than an error.
 */
export async function getQuote(
  inputMint: string,
  outputMint: string,
  amount: bigint,
  slippageBps = 100,
): Promise<JupiterQuote | null> {
  if (amount <= 0n) return null;

  try {
    return await jupiterFetch<JupiterQuote>("/swap/v1/quote", {
      inputMint,
      outputMint,
      amount: amount.toString(),
      slippageBps: slippageBps.toString(),
    });
  } catch (err) {
    if (err instanceof JupiterError && err.isUnavailable) return null;
    throw err;
  }
}

/**
 * Build the unsigned swap transaction for a quote.
 *
 * The lite API takes `quoteResponse` as a raw JSON object (the legacy v6 API
 * took base64) and real booleans, not strings.
 */
export async function buildSwapTx(
  quote: JupiterQuote,
  userPublicKey: PublicKey,
): Promise<VersionedTransaction> {
  const res = await fetch(`${JUPITER_API}/swap/v1/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: userPublicKey.toBase58(),
      dynamicComputeUnitLimit: true,
      skipUserAccountsRpcCalls: false,
      wrapAndUnwrapSol: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new JupiterError(
      `Jupiter /swap/v1/swap failed (${res.status}): ${body.slice(0, 200)}`,
      res.status,
    );
  }

  const { swapTransaction } = (await res.json()) as { swapTransaction: string };
  if (!swapTransaction) {
    throw new JupiterError("Jupiter returned no swapTransaction");
  }

  return VersionedTransaction.deserialize(
    Uint8Array.from(Buffer.from(swapTransaction, "base64")),
  );
}

/** Human-readable route, e.g. `SOL -> USDC -> NEAR`. */
export function describeRoute(quote: JupiterQuote): string {
  const symbols = new Map(
    Object.values(SWAP_TOKENS).map((t) => [t.mint, t.symbol]),
  );
  const label = (mint: string) => symbols.get(mint) ?? `${mint.slice(0, 4)}…`;
  const mints = [
    quote.inputMint,
    ...quote.routePlan.map((s) => s.swapInfo.outputMint),
  ];
  return mints.map(label).join(" → ");
}
