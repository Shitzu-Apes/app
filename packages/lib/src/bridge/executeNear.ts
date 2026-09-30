import { actionCreators } from "@near-wallet-selector/core";
import type { Transaction, WalletSelector } from "@near-wallet-selector/core";
import { ChainKind, getClient, omniAddress } from "omni-bridge-sdk";

import { CHAIN_KIND } from "./fee";
import {
  clearCapturedNearTxHash,
  lastCapturedNearSend,
  lastCapturedNearTxHash,
  withNajActions,
} from "./omni";
import type { RoutePlan } from "./search";
import {
  prepareDeposit,
  railOf,
  TransferError,
  type TransferProgress,
} from "./transfer";

import type { Network } from "$lib/models/tokens";
import {
  executableRoutes,
  getIntearRoutesRouted,
  routeToNajTransactions,
  selectBestRoute,
} from "$lib/near/intear";
import { isReverted, revertLog, type NearTxOutcome } from "$lib/near/outcome";
import {
  deliveredBySwap,
  ftStorageMin,
  ftStorageRegistered,
  nativeBalanceOf,
  receivedInTransaction,
  tokenBalanceOf,
} from "$lib/near/swapOutcome";

/**
 * How the codebase spells native NEAR as a token id.
 *
 * Not an alias of `wrap.near` and not an address: the two are separate balances, and
 * telling them apart is the entire job of the swap's outcome.
 */
const NEAR_NATIVE = "near";

/**
 * The wrapping contract on this build's network.
 *
 * `import.meta.env` is replaced at build time and does not exist under `node --test`,
 * so the mainnet contract is the fallback — read the way `omni.ts` reads its config,
 * and the Convert form is mainnet-only anyway.
 *
 * It is needed because the form measures one balance and the chain debits another. A
 * native NEAR row reaches the executors as this contract (the registry's address for
 * wNEAR), and any transaction that touches it — a straight bridge's deposit, the
 * input of a router swap — debits the *wrapped* balance, which the account only has
 * if it was wrapped first.
 */
const WRAP_NEAR = import.meta.env?.VITE_WRAP_NEAR_CONTRACT_ID ?? "wrap.near";

/**
 * The first half of a NEAR-sourced route: the swap into the rail, on its own.
 *
 * Split from the deposit because the two need to be two button presses. The deposit
 * is a wallet interaction of its own and happens minutes later, once the user has
 * committed to the conversion, so batching it in here spent the gesture on
 * everything at once and left the second signature with nothing to answer.
 *
 * It also removes the SDK's most fragile path. With `additionalTransactions` the
 * bridge's batch holds the swap *and* the locker call, and the SDK identifies the
 * transfer by scraping an `InitTransferEvent` out of the receipts' logs — which is
 * missing both when a receipt did not execute and when the wallet withholds the
 * logs. Alone, the batch is just the storage deposit and the locker call, so a
 * missing event is far more likely to be the benign cause.
 *
 * The rail balance is sampled here, before the swap, so the deposit can bridge
 * exactly what the swap produced. A delta rather than the balance afterwards: the
 * bridge takes the swap's output, not whatever wNEAR the account already held.
 */
export async function runNearSourceSwap({
  plan,
  amount,
  sourceTokenId,
  accountId,
  selector,
  onProgress,
}: {
  plan: RoutePlan;
  amount: bigint;
  sourceTokenId: string;
  accountId: string;
  selector: WalletSelector;
  onProgress?: (progress: TransferProgress) => void;
}): Promise<NearSwapLeg> {
  const rail = railOf(plan);
  onProgress?.({ leg: "swap", message: `Swapping into ${rail.symbol}…` });

  const route = selectBestRoute(
    executableRoutes(
      await getIntearRoutesRouted({
        tokenIn: sourceTokenId,
        tokenOut: rail.sourceAddress,
        amountIn: amount,
        traderAccountId: accountId,
        slippage: 0.03,
      }),
    ),
  );
  if (!route) {
    throw new TransferError(
      "No route to the bridge is available for that amount right now",
    );
  }

  const floor = BigInt(route.worst_case_amount.amount_out);
  if (floor <= 0n) {
    throw new TransferError("That amount is too small to swap");
  }

  // Sampled *before* the swap is signed. This has to be the balance as it stood
  // before the swap, or the difference taken afterwards is between two moments that
  // are both after the event and therefore says nothing at all.
  //
  // Both forms, and that is the whole point: a swap that pays out native NEAR never
  // touches the wrapped contract, so a baseline of one form alone reports a
  // difference of exactly zero for a swap that worked.
  const before = {
    wrapped: await tokenBalanceOf(rail.sourceAddress, accountId),
    native: await nativeBalanceOf(accountId),
  };

  // The router was asked for `token_in=wrap.near`, which builds a route that starts
  // by spending the wrapped balance — there is no `near_deposit` in it, because the
  // router was told the input *is* wNEAR. When the token being spent is the wrapping
  // contract, the balance behind it on this form is native NEAR, so whatever is not
  // already wrapped is wrapped here, in front of the route and in the same batch.
  const transactions = routeToNajTransactions(route);
  if (sourceTokenId === WRAP_NEAR) {
    transactions.unshift(
      ...(await wrapNearDeficit(WRAP_NEAR, accountId, amount)),
    );
  }

  const txHash = await signNearTransactions(selector, transactions);
  if (!txHash) {
    throw new TransferError(
      "The swap was sent but this wallet did not report the transaction, so its result cannot be read.",
    );
  }

  return {
    floor,
    txHash,
    accountId,
    railToken: rail.sourceAddress,
    before,
    // The token the swap consumed. Needed to know which balance a gain can be
    // measured against: the spent token's balance moves down, so its difference is
    // net of the swap and cannot be read as what arrived.
    spentToken: sourceTokenId,
    // What it was for. The swap is a fact about the chain and survives a
    // recalculation — but only for the amount it actually swapped, so this is what
    // decides whether it is still the right one.
    forAmount: amount,
  };
}

/**
 * What the swap delivered, in the form the deposit needs.
 *
 * Either form is a real outcome and both have to be handled. A swap that pays out
 * `wrap.near` is credited as a NEP-141 token and logs an `ft_transfer`. A swap that
 * pays out native NEAR is credited by a plain transfer, and a plain transfer emits no
 * event — so the two are not distinguishable by looking in the transaction, only by
 * looking at the balances.
 *
 * What comes back is the amount alone, and whoever deposits it has to make sure the
 * rail's contract actually holds that much. A native payout leaves the wrapped
 * contract untouched, so the deposit is what wraps the difference — see
 * `wrapNearDeficit` for why the wrapped form is not produced here.
 */
export async function railDelivered(swap: NearSwapLeg): Promise<bigint> {
  // The logs, first, for the one thing they are actually good for: saying whether the
  // swap reverted. A panicking call emits no events, so a failed swap's log list is
  // empty and a reader that only looks for arrivals concludes the swap delivered
  // nothing — which is what it reported, and it sent the reason away with it.
  try {
    const { native, tokens, reverted } = await receivedInTransaction(
      swap.txHash,
      swap.accountId,
    );
    if (reverted) {
      throw new TransferError(
        `The swap did not go through: ${reverted}. Nothing was bridged, and your tokens are still in your account.`,
      );
    }
    // A logged arrival is the best answer there is: it attributes the gain to this
    // transaction and to nothing else. The wrapped form always shows up here, because
    // a NEP-141 credit emits an event.
    const wrapped = tokens.get(swap.railToken);
    if (wrapped && wrapped.amount > 0n) {
      return wrapped.amount;
    }
    // A native credit only reaches this branch for a venue that logs one, which most
    // do not. Kept because it is free and it is right when it is there.
    if (native && native.amount > 0n) {
      return native.amount;
    }
  } catch (err) {
    // The answer we want, not a failure to read.
    if (err instanceof TransferError) throw err;
    // A node that cannot serve the transaction is worth knowing about, but it must not
    // end this: the balances below answer the same question.
    console.warn("[bridge] could not read the swap transaction", err);
  }

  // So the balances, across both forms. This is not a consolation prize — for a
  // native payout it is the *only* reading that exists, because a plain NEAR transfer
  // emits no event and so leaves nothing in the logs to find. A swap that worked and
  // arrived native was being reported as having delivered nothing at all.
  const [wrappedNow, nativeNow] = await Promise.all([
    tokenBalanceOf(swap.railToken, swap.accountId),
    nativeBalanceOf(swap.accountId),
  ]);

  // A form the swap also *spent* cannot be measured this way. Its balance moved down
  // as well, so the difference is net of both and is not what arrived: a swap of
  // 10 wNEAR that paid out 20 would read as a gain of 10. The logs cover that case
  // instead, because a wrapped arrival is always logged.
  const wrappedReadable = swap.spentToken !== swap.railToken;
  const nativeReadable = swap.spentToken !== NEAR_NATIVE;

  const wrappedGain = wrappedNow - swap.before.wrapped;
  if (wrappedReadable && wrappedGain > 0n) {
    return wrappedGain;
  }

  const nativeGain = nativeNow - swap.before.native;
  if (nativeReadable && nativeGain > 0n) {
    return nativeGain;
  }

  // Both forms named, because a message about only the wrapped contract is wrong
  // whenever the payout was native — and that is the case that reached here.
  throw new TransferError(readableError(swap, wrappedReadable, nativeReadable));
}

/**
 * Make the account hold at least `needed` of the wrapped contract, wrapping only
 * what it is missing.
 *
 * The bridge's deposit is an `ft_transfer_call` on `wrap.near`, so it debits the
 * *wrapped* balance — while the user's NEAR is, in the case this exists for, native.
 * Nothing else wraps it: a direct bridge has no swap in it to carry a `near_deposit`
 * along, and a swap that pays out native NEAR leaves the wrapped contract untouched.
 * So the account had to already hold the wrapped form, which is exactly the
 * assumption that made bridging native NEAR fail with "the bridge deposit was
 * rejected" while the money was sitting right there in the account.
 *
 * The already-wrapped balance is used first and only the difference is wrapped:
 * wrapping the whole amount would leave the existing wrapped tokens stranded as a
 * bonus rather than spending them, and on a 100% fill it would exceed the native
 * balance the form checked against.
 *
 * Returns the transactions to sign *before* the deposit, or none when the account
 * already holds enough — the common case for a second bridge.
 */
export async function wrapNearDeficit(
  wrapToken: string,
  accountId: string,
  needed: bigint,
): Promise<Omit<Transaction, "signerId">[]> {
  if (needed <= 0n) return [];

  const [wrapped, registered] = await Promise.all([
    tokenBalanceOf(wrapToken, accountId),
    ftStorageRegistered(wrapToken, accountId),
  ]);
  const deficit = needed > wrapped ? needed - wrapped : 0n;
  if (deficit === 0n) return [];

  const transactions: Omit<Transaction, "signerId">[] = [];

  // The first wrap has to register the account before `near_deposit` can credit
  // anything, and the min is read from the contract rather than assumed. A separate
  // `storage_deposit` rather than folding it into the attached amount, because
  // whether `near_deposit` registers on the way in is the contract's business: this
  // is correct either way, and it is the pattern the meme.cooking flow already uses
  // for the same contract.
  if (!registered) {
    transactions.push({
      receiverId: wrapToken,
      actions: [
        actionCreators.functionCall(
          "storage_deposit",
          {},
          20_000_000_000_000n,
          await ftStorageMin(wrapToken),
        ),
      ],
    });
  }

  transactions.push({
    receiverId: wrapToken,
    actions: [
      // `near_deposit` wraps the attached deposit, which for this pair is the
      // native-to-wrapped conversion and the only way to produce the rail's form.
      actionCreators.functionCall(
        "near_deposit",
        {},
        30_000_000_000_000n,
        deficit,
      ),
    ],
  });

  return transactions;
}

/**
 * Why neither balance grew, in terms of what could actually have been read.
 *
 * "No tokens arrived" and "the only form that could have grown is the one the swap
 * spent" need different things said about them, and collapsing them is how a
 * successful swap ended up described as having failed.
 */
function readableError(
  swap: NearSwapLeg,
  wrappedReadable: boolean,
  nativeReadable: boolean,
): string {
  if (!wrappedReadable && !nativeReadable) {
    return `The swap spent ${swap.railToken} and nothing arrived in either form, so there is nothing to bridge. Your tokens are still where the swap left them.`;
  }
  return `Neither ${swap.railToken} nor native NEAR grew in your account after the swap, so there is nothing to bridge. Your tokens are still where the swap left them.`;
}

/** What the swap half produced, and what the deposit half needs to know. */
export type NearSwapLeg = {
  /**
   * The amount the swap was signed to deliver at worst.
   *
   * Kept for the record, not as a check: the deposit deliberately carries what the
   * swap produced rather than this, so a value below the floor is a real outcome to
   * bridge, not an error to raise.
   */
  floor: bigint;
  /**
   * The swap's transaction.
   *
   * Read for one thing above all: whether it reverted, and why. A panicking call
   * emits no events, so a failed swap has an empty log list, and a reader that only
   * parses logs concludes the swap delivered nothing — when in fact it failed and
   * said exactly why. That is a different thing to tell a user, and the difference is
   * whether they should try again or go looking for their tokens.
   *
   * It is *not* how the amount is found, because a native NEAR credit is not in it:
   * plain NEAR transfers emit no event, so the logs can see the wrapped form and are
   * structurally blind to the native one.
   */
  txHash: string;
  /** Whose swap it was. */
  accountId: string;
  /** The rail's address on NEAR, which is what the deposit is denominated in. */
  railToken: string;
  /** The token the swap consumed, whose balance therefore moves down as well. */
  spentToken: string;
  /** The source amount this swap was made for. */
  forAmount: bigint;
  /**
   * The wrapped and native balances as they stood before the swap was signed.
   *
   * How the amount is found, because it is the only reading that covers both forms
   * of the rail. Both are sampled, and sampling one is not enough: a swap that
   * delivers native NEAR leaves the wrapped balance untouched, so a baseline of the
   * wrapped contract alone reports a difference of exactly zero for a swap that
   * worked — which is how a successful swap came to be reported as having delivered
   * nothing to bridge.
   */
  before: { wrapped: bigint; native: bigint };
};

/**
 * The second half: the bridge deposit, on its own, for whatever the swap produced.
 *
 * `amount` is the swap's output, in whichever form it arrived, measured after the fact
 * rather than signed for. Anything the swap delivered above the signed floor is
 * included, which is the point — the bridge takes what the swap actually did, not a
 * guess made before it ran.
 */
export async function runNearDeposit({
  plan,
  to,
  recipient,
  accountId,
  selector,
  swap,
  onProgress,
}: {
  plan: RoutePlan;
  to: Network;
  recipient: string;
  accountId: string;
  selector: WalletSelector;
  swap: NearSwapLeg;
  onProgress?: (progress: TransferProgress) => void;
}): Promise<NearSourceResult> {
  const rail = railOf(plan);
  onProgress?.({ leg: "bridge", message: `Bridging ${rail.symbol}…` });

  const produced = await railDelivered(swap);

  // The rail has to be in the account before the locker call debits it, and a swap
  // that paid out native NEAR leaves the wrapped contract untouched. So what the
  // account already holds wrapped is used first and only the missing part is wrapped,
  // in the same batch and before the deposit.
  const wrap =
    rail.tokenId === "NEAR"
      ? await wrapNearDeficit(rail.sourceAddress, accountId, produced)
      : [];

  const prepared = await prepareDeposit(plan, {
    from: "near",
    to,
    sender: accountId,
    recipient,
    amount: produced,
  });

  const client = getClient(ChainKind.Near, withNajActions(selector));
  clearCapturedNearTxHash();
  let rawEvent: { transfer_message: { origin_nonce: number } } | undefined;
  try {
    rawEvent = await client.initTransfer(
      {
        amount: prepared.amount,
        fee: prepared.fee.tokenFee,
        nativeFee: prepared.fee.nativeFee,
        recipient: omniAddress(CHAIN_KIND[to], recipient),
        tokenAddress: omniAddress(ChainKind.Near, rail.sourceAddress),
      },
      wrap.length > 0 ? { additionalTransactions: wrap } : {},
    );
  } catch (err) {
    if (!/InitTransferEvent not found/.test(String(err))) throw err;
    // The message is the same whether the batch failed or the wallet simply never
    // returned the logs, and the two must not be treated alike.
    //
    // A failed batch is the *expected* reason the event is missing: the locker call
    // that emits it never ran. Falling back to a hash there is what produced a
    // checkmark on a transfer that did not exist, followed by ninety seconds of
    // polling a hash the bridge API has never heard of. The failure state was
    // recorded with the hash for exactly this decision.
    const sent = lastCapturedNearSend();
    if (sent.reverted) {
      throw new TransferError(
        "The bridge deposit was rejected by NEAR, so nothing was bridged — you can safely try again.",
        err,
      );
    }
    if (!sent.txHash) {
      throw new TransferError(
        "The deposit was sent but this wallet did not report back what it signed, so the transfer cannot be tracked. Your funds are on their way — check your destination account in a few minutes.",
      );
    }
  }

  if (!rawEvent && !lastCapturedNearTxHash()) {
    throw new TransferError("The NEAR transaction was not accepted");
  }

  return {
    bridged: prepared.amount,
    tokenFee: prepared.fee.tokenFee,
    nativeFee: prepared.fee.nativeFee,
    usdFee: prepared.fee.usdFee,
    arrived: prepared.arrivedAmount,
    guaranteedSwapOut: produced,
    // Two handles on the same transfer, because the SDK only reliably offers one.
    // The hash comes first: it needs nothing parsed out of a log, and it is the
    // handle the Solana side already uses.
    txHash: lastCapturedNearTxHash(),
    originNonce: rawEvent?.transfer_message.origin_nonce,
  };
}

/**
 * Everything that needs a NEAR wallet.
 *
 * The interesting property here is that a NEAR-sourced route can be a *single*
 * transaction. The Intear router returns a worst-case output alongside the
 * estimate, so the swap can be signed with `min_amount_out` set to that floor
 * and the bridge deposit appended as extra actions on the same transaction,
 * depositing exactly what is guaranteed to arrive. One wallet prompt instead of
 * two, and no window where the swap has settled but nothing has been bridged.
 *
 * The cost is honest and worth stating: the user is guaranteed the floor, not the
 * estimate. Anything the swap delivers above the floor stays in their account as
 * a bonus rather than being bridged, and the UI says so before signing.
 */

/** Send a batch of already-built NAJ transactions through the user's wallet. */
/**
 * Run a same-chain conversion: one swap, signed once, no bridge.
 *
 * Reached when the user sends and receives on the same chain, which is how a
 * token that exists on only one chain is bought at all — OMGY has no Solana
 * liquidity, so on NEAR it is a plain swap rather than a bridge.
 */
export async function runSameChainSwap({
  plan,
  amountIn,
  chain,
  sourceTokenId,
  targetTokenId,
  accountId,
  selector,
  onProgress,
}: {
  plan: RoutePlan;
  /** In the source token's base units on `chain`. */
  amountIn: bigint;
  chain: Extract<Network, "near" | "solana">;
  /**
   * The two contracts to swap between, as the search priced them.
   *
   * Passed in rather than read off the plan, and this is the whole of a reported bug.
   * A same-chain plan has `rail: null` — there is no bridge, so there is no rail — and
   * the code derived the pair from it anyway: `rail ? rail.destAddress :
   * plan.targetSymbol`. With no rail that is `plan.targetSymbol` for *both* sides, so
   * the router was asked for `token_in=JLU&token_out=JLU`, a token against itself. It
   * reads as a market with no liquidity rather than as the malformed request it is, and
   * the conversion failed with the route it had just found on screen.
   *
   * A plan has no addresses for a same-chain conversion at all, so nothing can be
   * derived from it here. The caller knows them; it passes them.
   */
  sourceTokenId: string;
  targetTokenId: string;
  accountId?: string;
  selector: WalletSelector;
  onProgress?: (progress: TransferProgress) => void;
}): Promise<NearDestinationResult> {
  onProgress?.({ leg: "swap", message: `Swapping into ${plan.targetSymbol}…` });

  if (chain === "near") {
    const result = await runNearDestinationSwap({
      railTokenId: sourceTokenId,
      targetTokenId,
      amountIn,
      accountId: accountId!,
      selector,
      onProgress,
    });
    return result;
  }

  // Solana: Jupiter, signed by the wallet adapter rather than a wallet selector.
  const { runSolanaDestinationSwap } = await import("./executeSolanaSwapLeg");
  const { solanaWallet } = await import("$lib/solana/wallet");
  const result = await runSolanaDestinationSwap({
    railMint: sourceTokenId,
    targetMint: targetTokenId,
    amountIn,
    provider: solanaWallet.getProvider()!,
    onProgress,
  });
  return {
    received: result.received,
    guaranteed: result.guaranteed,
    dexes: result.venues,
    // A Solana swap is a single transaction, whichever venues it crosses.
    transactions: 1,
  };
}

/**
 * Sign and send a route's transactions: the whole sequence, in one call.
 *
 * The router's routes are frequently *dependent*. One real route for
 * `wrap.near → token.0xshitzu.near` is:
 *
 *     tx0  dex.intear.near  storage_deposit + register_assets
 *     tx1  wrap.near         near_withdraw
 *     tx2  dex.intear.near  deposit_near
 *
 * `deposit_near` needs the native NEAR that `near_withdraw` produces and the
 * registration `tx0` makes, so the order matters. That is what
 * `signAndSendTransactions` is for: it takes a *sequence*, and the wallet signs and
 * submits it in order. Passing one transaction per call instead — which this
 * briefly did, on the mistaken belief that a "batch" is executed in parallel —
 * turns one route into N wallet interactions, of which only the first is inside the
 * user's click, and the browser blocks the popups for the rest. That claim is true
 * of raw `send_tx` with independent transactions; it is not true of this API.
 *
 * The count is not fixed either: a user's first trade with that venue also carries
 * the registration and later ones do not, so the same pair returns three or four
 * transactions depending on state we do not track. Counting the instructions and
 * handing them over together needs no per-venue branch, and covers whatever the
 * router returns next.
 *
 * Each transaction is also *checked*. NEAR can resolve a transaction whose receipts
 * contain a failure, and a route that reported success having only half landed
 * would leave the user told they were swapped.
 */

/**
 * Hand a route's whole sequence to the wallet in one call, then check the result.
 *
 * The `submit` seam is the point: what matters is that the route goes over as a
 * single call carrying every transaction, and that the returned outcomes are read.
 * Neither needs a wallet, so both are testable without one.
 *
 * Note there is deliberately no per-transaction loop here. `signAndSendTransactions`
 * takes a *sequence*, and the wallet signs and submits it in order — that is what
 * the method is for, and the repo's own buy/sell has always passed an array this
 * way. Calling it once per transaction instead makes the wallet N separate
 * interactions, of which only the first is inside the user's click, and the browser
 * blocks the popups for the rest.
 */
export async function runRouteTransactions<T>(
  transactions: readonly T[],
  submit: (
    transactions: readonly T[],
  ) => Promise<readonly NearTxOutcome[] | void>,
  onSubmit?: (total: number) => void,
): Promise<readonly NearTxOutcome[]> {
  if (transactions.length === 0) return [];

  // Announced before the call rather than between calls: the wallet owns the
  // sequencing now, so there is nothing to report until it comes back.
  onSubmit?.(transactions.length);

  // Some wallets resolve with nothing at all — the browser wallet redirects away and
  // comes back without the outcome. There is no failure signal to read in that case,
  // so an absent outcome is neither a success nor a failure: it is unverifiable, and
  // inventing either would be a lie. The wallets that do return outcomes are read
  // below.
  const outcomes = (await submit(transactions)) ?? [];

  // A reverted NEAR transaction resolves rather than throws, so the outcome has to
  // be read or a failed route reports itself as a completed one.
  //
  // Failure shows up in three places depending on the wallet and how far the
  // transaction got: the summary `status` is either the string "Failure" or a
  // `{ Failure: ExecutionError }` object, and each receipt carries its own `id`.
  // All three are checked because relying on one of them means a route that failed
  // is reported as finished on the wallets that spell it the other way.
  const failedAt = outcomes.findIndex(isReverted);
  if (failedAt === -1) return outcomes;

  // The receipt carries the revert reason verbatim, and it is the only thing that
  // says *why* — a route that dies on a slippage floor or a stale pool reservation
  // is otherwise indistinguishable from any other failure.
  const log = revertLog(outcomes[failedAt]);
  const where = `Transaction ${failedAt + 1} of ${transactions.length} reverted`;
  throw new TransferError(
    log ? `${where}: ${log}` : `${where}. The earlier ones went through.`,
  );
}

/**
 * Did this transaction actually go through?
 *
 * NEAR resolves a reverted transaction rather than rejecting the promise, so
 * nothing throws and the only way to know is to read the outcome. This is not a
 * nicety: treating a revert as a success is how a step gets a checkmark for a
 * transfer that does not exist.
 *
 * Failure shows up in three places, and which one is populated depends on the
 * wallet and how far the transaction got:
 *
 *   - `status` is the string `"Failure"`, or a `{ Failure: ExecutionError }` object
 *   - `transaction_outcome.id` is `"Failure"`
 *   - a receipt in `receipts_outcome` has `id === "Failure"`
 *
 * All three are checked, because reading only one means a failure is reported as a
 * success on the wallets that spell it the other way.
 *
 * Structural types rather than imported ones: the shape varies between wallets and
 * between `@near-js` versions, and every field is optional in practice.
 */
export async function signNearTransactions(
  selector: WalletSelector,
  transactions: Omit<Transaction, "signerId">[],
  onSubmit?: (total: number) => void,
): Promise<string | undefined> {
  const wallet = await selector.wallet();
  if (!wallet) {
    throw new TransferError("No NEAR wallet is available");
  }

  const outcomes = await runRouteTransactions(
    transactions,
    // The whole route, in one call. This is the array the method expects and the
    // shape the working buy/sell already uses.
    (route) =>
      wallet.signAndSendTransactions({
        transactions: route as Omit<Transaction, "signerId">[],
      }),
    onSubmit,
  );

  // The last transaction's hash. The caller needs it to read what the swap actually
  // did — a balance sampled either side of a swap cannot attribute the gain to this
  // transaction, and cannot say whether the tokens arrived wrapped or native.
  const last = outcomes[outcomes.length - 1] as
    | { transaction?: { hash?: string } }
    | undefined;
  return last?.transaction?.hash;
}

export type NearSourceResult = {
  /** What was handed to the bridge, in the rail's NEAR base units. */
  bridged: bigint;
  tokenFee: bigint;
  nativeFee: bigint;
  usdFee: number | null;
  /** What lands on the destination before any final swap. */
  arrived: bigint;
  /**
   * The floor the swap was signed at. The deposit carries exactly this, so
   * anything the swap delivers above it is left behind rather than bridged.
   */
  guaranteedSwapOut: bigint;
  /**
   * Two handles on the transfer, because the SDK only reliably gives one.
   *
   * `txHash` is preferred: it needs nothing parsed out of a receipt log and is the
   * same handle the Solana side uses. `originNonce` is the SDK's own and is absent
   * when it failed to find its event. With neither, the transfer cannot be tracked
   * and the caller must say so rather than guess.
   */
  txHash?: string;
  originNonce?: number;
};

/**
 * Run the NEAR side of a route.
 *
 * The swap is re-quoted here rather than reusing the search's numbers, for the
 * same reason the Solana flow does: a quote the user has been looking at is not
 * the quote that will execute, and a stale floor is a reverted transaction. The
 * bridge fee is then quoted on that fresh floor, because that is the number the
 * deposit will carry.
 */
export async function runFromNear({
  plan,
  amount,
  sourceTokenId,
  to,
  recipient,
  accountId,
  selector,
  onProgress,
}: {
  plan: RoutePlan;
  /** What the user asked to send, in the source token's NEAR base units. */
  amount: bigint;
  /** The source token's NEP-141 contract id, or `near` for native NEAR. */
  sourceTokenId: string;
  /** Which chain the recipient address belongs to. */
  to: Network;
  /** Address on `to`. */
  recipient: string;
  /** The NEAR account that signs. */
  accountId: string;
  selector: WalletSelector;
  onProgress?: (progress: TransferProgress) => void;
}): Promise<NearSourceResult> {
  const rail = railOf(plan);
  const swapTransactions: Omit<Transaction, "signerId">[] = [];
  let bridged = amount;
  let guaranteedSwapOut = amount;

  if (plan.sourceSwap) {
    onProgress?.({
      leg: "swap",
      message: `Swapping into ${rail.symbol}…`,
    });

    const route = selectBestRoute(
      executableRoutes(
        await getIntearRoutesRouted({
          tokenIn: sourceTokenId,
          tokenOut: rail.sourceAddress,
          amountIn: amount,
          traderAccountId: accountId,
          slippage: 0.03,
        }),
      ),
    );
    if (!route) {
      throw new TransferError(
        "No route to the bridge is available for that amount right now",
      );
    }

    const floor = BigInt(route.worst_case_amount.amount_out);
    if (floor <= 0n) {
      throw new TransferError("That amount is too small to swap");
    }

    swapTransactions.push(...routeToNajTransactions(route));
    // Deposit the floor, not the estimate. Batching the deposit onto the swap
    // means it can only ever be for an amount the swap guarantees, and whatever
    // the swap delivers above the floor is left in the account as a bonus.
    bridged = floor;
    guaranteedSwapOut = floor;
  }

  // Everything this batch takes from the wrapping contract is, on this form, the
  // user's native NEAR: a straight bridge's own deposit (there is no swap to carry a
  // `near_deposit`), or the input of the source swap, which the router was told was
  // wNEAR and therefore did not wrap. What the account already holds wrapped is used
  // and only the missing part is wrapped, in front of the batch and in one signature.
  const spendingWrappedNear =
    sourceTokenId === WRAP_NEAR ||
    (plan.sourceSwap === null && sourceTokenId === NEAR_NATIVE);
  if (spendingWrappedNear) {
    swapTransactions.unshift(
      ...(await wrapNearDeficit(WRAP_NEAR, accountId, amount)),
    );
  }

  onProgress?.({ leg: "bridge", message: `Bridging ${rail.symbol}…` });

  const prepared = await prepareDeposit(plan, {
    from: "near",
    to,
    sender: accountId,
    recipient,
    amount: bridged,
  });

  // `withNajActions` normalises the action shape the SDK emits into the one the
  // wallet selector expects, while leaving our own already-NAJ swap actions
  // untouched. Without it the deposit fails at signing on Intear.
  const client = getClient(ChainKind.Near, withNajActions(selector));
  clearCapturedNearTxHash();
  let rawEvent: { transfer_message: { origin_nonce: number } } | undefined;
  try {
    rawEvent = await client.initTransfer(
      {
        amount: prepared.amount,
        fee: prepared.fee.tokenFee,
        nativeFee: prepared.fee.nativeFee,
        recipient: omniAddress(CHAIN_KIND[to], recipient),
        tokenAddress: omniAddress(ChainKind.Near, rail.sourceAddress),
      },
      // One batch, in order: the swap's actions first, then the deposit. Sending
      // them separately would mean the user signs twice and leaves a window where
      // the swap has settled but nothing has been bridged. The bridge takes
      // whatever the swap delivered, so the two cannot be separated anyway.
      { additionalTransactions: swapTransactions },
    );
  } catch (err) {
    // The SDK identifies the transfer by scraping an `InitTransferEvent` out of the
    // receipts' logs, and throws when it is not there. That happens for two
    // unrelated reasons — a receipt that did not execute, and a wallet that returns
    // outcomes with empty `receipts_outcome` — and the SDK's message cannot tell
    // them apart, nor does it hand back the transaction hash that would.
    //
    // So the hash is captured on the way past and used instead. The bridge API
    // answers to a transaction hash as readily as to a nonce, which is how the
    // Solana side has always identified its deposits. A transfer with neither a
    // nonce nor a hash genuinely cannot be tracked, and saying so is the only
    // honest outcome.
    if (!/InitTransferEvent not found/.test(String(err))) throw err;
    // The message is the same whether the batch failed or the wallet simply never
    // returned the logs, and the two must not be treated alike.
    //
    // A failed batch is the *expected* reason the event is missing: the locker call
    // that emits it never ran. Falling back to a hash there is what produced a
    // checkmark on a transfer that did not exist, followed by 90 seconds of polling
    // a hash the bridge API has never heard of. The failure state was recorded with
    // the hash for exactly this decision, so it is consulted before anything else.
    const sent = lastCapturedNearSend();
    if (sent.reverted) {
      throw new TransferError(
        "The bridge deposit was rejected by NEAR, so nothing was bridged — you can safely try again.",
        err,
      );
    }
    if (!sent.txHash) {
      throw new TransferError(
        "The deposit was sent but this wallet did not report back what it signed, so the transfer cannot be tracked. Your funds are on their way — check your destination account in a few minutes.",
      );
    }
  }

  if (!rawEvent && !lastCapturedNearTxHash()) {
    throw new TransferError("The NEAR transaction was not accepted");
  }

  return {
    bridged: prepared.amount,
    tokenFee: prepared.fee.tokenFee,
    nativeFee: prepared.fee.nativeFee,
    usdFee: prepared.fee.usdFee,
    arrived: prepared.arrivedAmount,
    guaranteedSwapOut,
    // Two handles on the same transfer, because the SDK only reliably offers one.
    // The hash comes first: it needs nothing parsed out of a log, and it is the
    // handle the Solana side already uses.
    txHash: lastCapturedNearTxHash(),
    originNonce: rawEvent?.transfer_message.origin_nonce,
  };
}

export type NearDestinationResult = {
  /** What the swap delivered, in the target's base units. */
  received: bigint;
  /** The floor it was signed at. */
  guaranteed: bigint;
  dexes: string[];
  /** How many transactions the route needed, i.e. how many signatures. */
  transactions: number;
};

/**
 * Swap the arrived rail into the token the user actually asked for.
 *
 * This runs as its own transaction *after* the bridge has finalised, and it has
 * to. NEAR has no meta-transactions and no scheduled execution, so there is no
 * way to pre-authorise a swap against funds that do not exist yet. The user signs
 * a second time on the destination chain once the first leg has landed.
 *
 * A route that has died in the meantime is not an error worth a red toast: the
 * user is holding the rail token and can swap it themselves, and that is a
 * strictly better outcome than anything a relayer could have done with it.
 */
export async function runNearDestinationSwap({
  railTokenId,
  targetTokenId,
  amountIn,
  accountId,
  selector,
  onProgress,
}: {
  /** The arrived rail's NEP-141 contract id on NEAR. */
  railTokenId: string;
  /** The target's NEP-141 contract id on NEAR, or `near`. */
  targetTokenId: string;
  /** What arrived, in the rail's NEAR base units. */
  amountIn: bigint;
  accountId: string;
  selector: WalletSelector;
  onProgress?: (progress: TransferProgress) => void;
}): Promise<NearDestinationResult> {
  onProgress?.({ leg: "convert", message: "Converting on Near…" });

  const route = selectBestRoute(
    executableRoutes(
      await getIntearRoutesRouted({
        tokenIn: railTokenId,
        tokenOut: targetTokenId,
        amountIn,
        traderAccountId: accountId,
        slippage: 0.03,
      }),
    ),
  );

  if (!route) {
    throw new TransferError(
      "The route into your target token is no longer available. Your tokens have arrived — swap them from the token list.",
    );
  }

  const transactions = routeToNajTransactions(route);

  // A route quoted from the wrapping contract starts by spending wNEAR, and the
  // router was told the input *is* wNEAR, so it has no `near_deposit` in it. When the
  // form's source row was native NEAR, that contract is only the address of the
  // balance the user actually holds: whatever is not already wrapped is wrapped here,
  // in front of the route and in the same batch.
  //
  // Never for a native `near` input — that is the arrival side, where the account
  // already holds the native form and the router's own `near_deposit` does the
  // wrapping. Wrapping again there would wrap the same NEAR twice.
  if (railTokenId === WRAP_NEAR) {
    transactions.unshift(
      ...(await wrapNearDeficit(WRAP_NEAR, accountId, amountIn)),
    );
  }

  const txHash = await signNearTransactions(selector, transactions, (total) => {
    // The count, not a running step. The wallet owns the sequencing now, so
    // reporting "step 2 of 3" would be narrating something we cannot observe — and
    // a count we know up front is the useful part: it is how many signatures they
    // are about to give.
    onProgress?.({
      leg: "convert",
      message:
        total > 1
          ? `Signing ${total} transactions on Near…`
          : "Converting on Near…",
    });
  });

  // Checked, because this function's return value is the app's evidence that a swap
  // happened. The source swap has always checked; this one did not, so a wallet that
  // reported nothing — a blocked popup, a dismissed one, a browser refusing a prompt
  // that is not tied to a gesture — fell straight through and the transfer was
  // reported complete. The receipt then quoted a "received" amount for a swap that was
  // never signed.
  if (!txHash) {
    throw new TransferError(
      "Your wallet did not sign the swap into your target token, so it was not done. Your bridged tokens have arrived — swap them from the token list.",
    );
  }

  // What actually arrived, not what the router predicted.
  //
  // This used to be `estimated_amount`, which is a forecast: the number the router
  // hoped for before the swap ran. The receipt calls its figure "You received", so a
  // forecast in that slot is a lie told with a confident font. The transaction's own
  // logs are the measurement, and when they cannot be read the *guaranteed* figure is
  // used — a floor the swap was signed at, which is a real commitment, rather than an
  // estimate.
  const delivered = await deliveredBySwap(txHash, targetTokenId, accountId);

  return {
    received: delivered ?? BigInt(route.worst_case_amount.amount_out),
    guaranteed: BigInt(route.worst_case_amount.amount_out),
    dexes: [route.dex_id],
    /**
     * How many signatures this took. A route through a venue that has to unwrap,
     * register and deposit is three or four transactions where a single-pool swap
     * is one, and the user is signing each of them — so the count belongs on
     * screen rather than in the implementation.
     */
    transactions: transactions.length,
  };
}
