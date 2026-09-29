import { actionCreators } from "@near-wallet-selector/core";
import type { Transaction } from "@near-wallet-selector/core";

/**
 * Client for Intear's NEAR DEX aggregator.
 *
 * This is the NEAR-side counterpart to `src/lib/solana/jupiter.ts`, and it is
 * what makes an any-to-any transfer possible: the Omni Bridge only ever moves a
 * registered token, so getting from an arbitrary token to a bridgeable one (and
 * from the arrived token to what the user actually asked for) needs a swap on
 * whichever chain they are standing on.
 *
 * Every quirk below was found by calling the live API, and each one fails
 * silently or confusingly rather than loudly.
 */

/** Public, key-less, CORS-open (`access-control-allow-origin: *`). */
export const INTEAR_ROUTER = "https://router.intear.tech/route";

/** Mainnet only. The docs state there is no testnet deployment. */
export const INTEAR_SUPPORTED_NETWORKS = ["mainnet"] as const;

export type IntearFunctionCall = {
  method_name: string;
  /** Base64-encoded JSON arguments. */
  args: string;
  /** Returned as a string by some DEXes and a number by others. */
  gas: string | number;
  deposit: string | number;
};

export type IntearNearTransaction = {
  receiver_id: string;
  actions: { FunctionCall: IntearFunctionCall }[];
  continue_if_failed?: boolean;
};

/**
 * A request-for-quote leg that needs an off-chain solver relay and a NEP-413
 * signature. We do not implement that, and Intear's own docs describe it as
 * having poor liquidity and long wait times, so these routes are dropped rather
 * than executed. The union is kept so an unexpected shape is a type error
 * instead of a silent no-op.
 */
export type IntearIntentsQuote = {
  message_to_sign: unknown;
  quote_hash: string;
};

export type IntearRoute = {
  deadline: string | null;
  has_slippage: boolean;
  estimated_amount: { amount_out: string };
  worst_case_amount: { amount_out: string };
  dex_id: string;
  execution_instructions: (
    | { NearTransaction: IntearNearTransaction }
    | { IntentsQuote: IntearIntentsQuote }
  )[];
  /**
   * What this route actually pays out, which is not always `token_out`: a DEX
   * can need an intermediate representation, so the caller must read the output
   * token off the route rather than assume it matches the request.
   */
  token_output: string;
};

export class IntearError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "IntearError";
  }
}

/**
 * Canonical token id for the router.
 *
 * The docs say both `usdt.tether-token.near` and `nep141:usdt.tether-token.near`
 * are accepted. Only the first one is: the prefixed form returns an empty route
 * list with HTTP 200 for every pair, so a typo here looks exactly like a token
 * with no liquidity. Strip the prefix rather than trust the docs.
 */
export function normalizeTokenId(tokenId: string): string {
  const trimmed = tokenId.trim();
  if (trimmed === "near" || trimmed === "wrap.near") return trimmed;
  return trimmed.replace(/^nep141:/, "").replace(/^rhea-nep141:\s*/, "");
}

export type IntearQuery = {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  /**
   * Account that will sign. Not optional in practice: without it the router
   * omits the `near_deposit` / `storage_deposit` actions its routes depend on,
   * because it cannot know what the signer is already registered for. A `Wrap`
   * route requested without it comes back missing the deposit that funds it.
   */
  traderAccountId: string;
  /** Floor as a fraction: 0.03 is 3%. */
  slippage?: number;
  /**
   * How long the router may hold the request open. Near Intents in particular
   * can price better given longer, but every route waits this long, so it is
   * the router's latency as well as its patience. Required by the API: omitting
   * it is a 400, not a default.
   */
  maxWaitMs?: number;
  dexes?: string[];
  referrerId?: string;
  signal?: AbortSignal;
};

/**
 * The query string, built separately so it can be asserted on without a network
 * round trip. Getting these parameter names wrong is the difference between
 * "no route" and a 400, and both read as a dead token to the user.
 */
export function buildRouteQuery({
  tokenIn,
  tokenOut,
  amountIn,
  traderAccountId,
  slippage = 0.03,
  maxWaitMs = 1_000,
  dexes,
  referrerId,
}: Omit<IntearQuery, "signal">): URLSearchParams {
  const params = new URLSearchParams({
    token_in: normalizeTokenId(tokenIn),
    token_out: normalizeTokenId(tokenOut),
    amount_in: amountIn.toString(),
    max_wait_ms: String(maxWaitMs),
    // Auto rather than Fixed: the pools these routes use are mostly thin, and a
    // fixed floor wide enough to clear them on a large trade lets a small one
    // through at a price no user would have accepted.
    slippage_type: "Auto",
    max_slippage: String(slippage),
    min_slippage: "0.001",
    trader_account_id: traderAccountId,
  });
  if (dexes?.length) params.set("dexes", dexes.join(","));
  if (referrerId) params.set("referrer_id", referrerId);
  return params;
}

/**
 * Every route the router can build, in whatever order it returned them.
 *
 * An empty array is the normal, expected answer for a token with no liquidity —
 * it is a 200 with `[]`, not an error — so callers get an empty list rather than
 * a null they have to unwrap. Only a malformed request throws, because that is a
 * bug in our query rather than a fact about the market.
 *
 * There is deliberately no retry on an empty result *here*. Cold router state has
 * been observed to return `[]` for a pair that routes moments later, but empty is
 * also the *common* answer: of the seven tokens that can carry a NEAR/Solana bridge,
 * three to six have no pool at any given moment, and a retry inside this call cannot
 * tell those apart. It would also be the wrong shape — the same seven requests
 * re-fired immediately land inside one cold window, measured at six consecutive
 * empties, so they fail together.
 *
 * So the retry is one level up, in `getIntearRoutesRouted` for a leg that matters,
 * and in the form for a search: it scores several rails at once, and when *every* one
 * comes back empty it re-runs the whole search after a real wait. One spurious empty
 * only costs that rail the round; seven of them are one cold window seen seven times,
 * and that is the case that has to be asked again rather than reported as no route.
 */
export async function getIntearRoutes(
  query: IntearQuery,
): Promise<IntearRoute[]> {
  const url = `${INTEAR_ROUTER}?${buildRouteQuery(query)}`;

  const res = await fetch(url, { signal: query.signal });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new IntearError(
      `Intear router failed (${res.status}): ${body.slice(0, 200)}`,
      res.status,
    );
  }

  const body = (await res.json()) as IntearRoute[] | unknown;
  if (!Array.isArray(body)) {
    throw new IntearError(
      `Intear router returned ${typeof body}, expected a route array`,
    );
  }
  return body;
}

/**
 * How many times to re-ask the router before believing an empty answer.
 *
 * Measured live against `wrap.near → token.0xshitzu.near`, the pair from a real
 * report: 16 of 20 identical requests returned routes, 7 of 10 at a different
 * size, 9 of 10 at another. The empty rate is 10–30% and it is **not** related to
 * the amount — 0.01 NEAR fails as often as 20 NEAR — so this is the router being
 * cold, not a minimum size or a thin pool. There is no such thing as a minimum
 * swap here; every amount from 0.005 NEAR upwards routes.
 */
const ROUTE_ATTEMPTS = 5;

/**
 * Milliseconds before the second, third, fourth and fifth attempt.
 *
 * The delay is the part that actually fixes it, and the attempts alone do not.
 * Measured: thirty identical requests fired back to back produced a run of *six*
 * consecutive empty answers, so three immediate retries all land inside the same
 * cold window and all three fail — which is exactly the "it sent empty array
 * multiple times in a row" report. The same requests spaced 250 ms apart never
 * produced a run longer than two.
 *
 * So the retry waits, and waits progressively longer, because the cold window is
 * a couple of seconds rather than a single request. Growing rather than fixed
 * because there is no reason to be impatient on the fifth attempt, and jitter so
 * that several people retrying at once do not fall into step.
 *
 * Not tuned to an optimum, and it would be dishonest to claim otherwise: the
 * router's health swings between roughly 0% and 30% empty over minutes, which is
 * a longer window than can be A/B tested in one sitting. These values are chosen to
 * clear the longest burst actually observed.
 */
const ROUTE_BACKOFF_MS = [500, 1000, 1500, 2000];

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

/**
 * Routes from the router, retried while the answer is empty, waiting between
 * attempts.
 *
 * This lives beside the router call rather than at each call site because the
 * search and the two execution legs all need it, and they had drifted: the search
 * retried and the execution did not, so a route could be quoted and then fail on
 * a single un-retried call. The search is what put the route on screen, so the
 * execution has to be at least as persistent as the search was.
 *
 * A retry is a *quote* retry. It happens before anything is signed, so it cannot
 * swap twice.
 */
export async function getIntearRoutesRouted(
  query: IntearQuery,
  {
    attempts = ROUTE_ATTEMPTS,
    backoffMs = ROUTE_BACKOFF_MS,
  }: { attempts?: number; backoffMs?: readonly number[] } = {},
): Promise<IntearRoute[]> {
  let routes: IntearRoute[] = [];
  for (let attempt = 1; attempt <= attempts; attempt++) {
    routes = await getIntearRoutes(query);
    if (routes.length > 0) return routes;
    // A superseded or aborted request should stop the loop rather than spend the
    // remaining attempts — and the remaining seconds — on an answer nobody will
    // read.
    if (query.signal?.aborted) break;
    const wait = backoffMs[attempt - 1];
    if (wait !== undefined) {
      await sleep(wait + Math.random() * 250, query.signal);
    }
  }
  return routes;
}

/** Routes we know how to execute: Near Intents are excluded on purpose. */
export function executableRoutes(routes: IntearRoute[]): IntearRoute[] {
  return routes.filter((route) =>
    route.execution_instructions.every(
      (instruction) => "NearTransaction" in instruction,
    ),
  );
}

/** What lands in the destination account, and the floor the route guarantees. */
export function routeAmounts(route: IntearRoute): {
  estimatedOut: bigint;
  worstCaseOut: bigint;
} {
  return {
    estimatedOut: BigInt(route.estimated_amount.amount_out),
    worstCaseOut: BigInt(route.worst_case_amount.amount_out),
  };
}

/**
 * The route that leaves the user most, measured on the guaranteed floor.
 *
 * Ranking on `estimated_amount` looks better and is wrong: it is the number a
 * user cannot rely on, and on a thin pool the gap between the two is exactly
 * where a bad route hides. The estimate is still reported, so the UI can show
 * the spread rather than hiding it.
 */
export function selectBestRoute(
  routes: IntearRoute[],
): IntearRoute | undefined {
  let best: IntearRoute | undefined;
  for (const route of routes) {
    if (!best) {
      best = route;
      continue;
    }
    if (routeAmounts(route).worstCaseOut > routeAmounts(best).worstCaseOut) {
      best = route;
    }
  }
  return best;
}

function decodeArgs(args: string): Record<string, unknown> {
  // The router base64-encodes the JSON object, but it is a JSON *string* inside
  // for some DEXes, so a plain JSON.parse of the decoded text is not enough.
  const text = atob(args);
  const parsed = JSON.parse(text) as unknown;
  if (typeof parsed === "string")
    return JSON.parse(parsed) as Record<string, unknown>;
  return (parsed ?? {}) as Record<string, unknown>;
}

/**
 * Turn a route into NEAR transactions the wallet selector can sign.
 *
 * Each `NearTransaction` becomes one entry, preserving the router's ordering:
 * a route is frequently `near_deposit` then `ft_transfer_call`, and reversing or
 * merging them breaks it. `signAndSendTransactions` sends the batch in order.
 */
export function routeToNajTransactions(
  route: IntearRoute,
): Omit<Transaction, "signerId">[] {
  return route.execution_instructions.flatMap((instruction) => {
    if (!("NearTransaction" in instruction)) return [];
    const tx = instruction.NearTransaction;
    return [
      {
        receiverId: tx.receiver_id,
        actions: tx.actions.map(({ FunctionCall: call }) =>
          actionCreators.functionCall(
            call.method_name,
            decodeArgs(call.args),
            BigInt(call.gas),
            BigInt(call.deposit),
          ),
        ),
      },
    ];
  });
}

/** `Rhea -> RheaDcl -> Wrap`, for the route readout. */
export function describeRouteDexes(routes: IntearRoute[]): string {
  return routes.map((route) => route.dex_id).join(" → ");
}
