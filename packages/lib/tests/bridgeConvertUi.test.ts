import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { CONVERT_CHAINS } from "../src/bridge/rail.ts";

/** Read a file relative to the repository root. */
const repo = (p: string) =>
  readFileSync(
    fileURLToPath(new URL(`../../../${p}`, import.meta.url)),
    "utf8",
  );

const PANEL = "src/bridge/AnyToAnyPanel.svelte";
const SEARCH = "src/bridge/search.ts";
const SOURCE_LIST = "src/bridge/SourceTokenList.svelte";
const TARGET_LIST = "src/bridge/TargetTokenList.svelte";
const END = "src/bridge/ChainEnd.svelte";
const panel = readFileSync(PANEL, "utf8");
const search = readFileSync(SEARCH, "utf8");
const sourceList = readFileSync(SOURCE_LIST, "utf8");
const targetList = readFileSync(TARGET_LIST, "utf8");
const end = readFileSync(END, "utf8");

test("no derived value hides behind a function call", () => {
  // Svelte works out what a `$:` statement depends on from the identifiers it can
  // see. A call to a local function registers only that function, whose identity
  // never changes, so the statement runs once and never again. Every one of these
  // was a live bug: the token list stayed empty because it was computed before
  // the wallet loaded, and the address stayed on the previous chain's wallet
  // while the chain name beside it updated.
  assert.doesNotMatch(panel, /\$\:\s*sourceOptions = buildSourceOptions\(\)/);
  // The arguments are what make it reactive, so their presence is the point.
  assert.match(
    panel,
    /\$\:\s*sourceOptions = buildSourceOptions\(\s*source,\s*solanaTokens/,
  );
  // The addresses must be reactive assignments, not calls in the template.
  assert.match(panel, /\$\:\s*senderAddress\s*=/);
  assert.match(panel, /\$\:\s*recipientAddress\s*=/);
  // Comments are stripped first: the component documents this exact bug in prose,
  // and a plain match would find the explanation rather than the defect.
  const code = panel
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /address=\{senderAddress\(\)\}/);
  assert.doesNotMatch(code, /address=\{recipientAddress\(\)\}/);
  assert.doesNotMatch(code, /connected=\{Boolean\(senderAddress\(\)\)\}/);
  assert.doesNotMatch(code, /connected=\{Boolean\(recipientAddress\(\)\)\}/);
});

test("a wallet that changes mid-load does not have stale tokens applied", () => {
  // The same check used to be written inline at one point. It is a named predicate now
  // because the loader retries, and a guard that has to be repeated before every
  // attempt is a guard that will be repeated wrongly somewhere.
  assert.match(panel, /const sameWallet = \(\) =>/);
  assert.match(
    panel,
    /\$publicKey\$\?\.toBase58\(\) === requested\.toBase58\(\)/,
  );
  assert.match(panel, /if \(!sameWallet\(\)\) return;/);
});

test("the token list falls back to something routable", () => {
  // Selecting a token Jupiter does not know as the default would open the form on
  // a pair that cannot be swapped.
  assert.match(panel, /found\.find\(\(t\) => t\.routable\)\?\.mint/);
});

test("both chain ends are chosen, not assumed to be opposites", () => {
  // Forcing the destination to be whatever the source is not means the user
  // cannot express the most ordinary request there is: sending something the
  // other way. Both ends get a picker.
  assert.match(panel, /let source: ConvertChain = "solana"/);
  assert.match(panel, /let dest: ConvertChain = "near"/);
  assert.match(panel, /function pickSource/);
  assert.match(panel, /function pickDest/);
  assert.doesNotMatch(panel, /destNetwork = fromSolana \? "near" : "solana"/);
});

test("picking a chain does not force the other end to change", () => {
  // Sending to the chain you are already on is a plain swap, and for a token that
  // exists on one chain it is the only route there is. Forcing the two ends apart
  // made OMGY unreachable: it has no Solana liquidity at all, so from NEAR the
  // only answer is NEAR to NEAR.
  assert.match(
    panel,
    /function pickSource\(chain: ConvertChain\) \{\s*\n\s*source = chain;/,
  );
  assert.match(
    panel,
    /function pickDest\(chain: ConvertChain\) \{\s*\n\s*dest = chain;/,
  );
  assert.doesNotMatch(panel, /if \(chain === dest\) dest = source;/);
  assert.doesNotMatch(panel, /if \(chain === source\) source = dest;/);
  // And the picker says so, rather than leaving the user to work it out.
  assert.match(panel, /sameChain=\{source === dest\}/);
});

test("changing a chain resets the quote rather than leaving a stale one", () => {
  // The search is priced for a specific pair of chains; keeping the previous
  // result would show a route that no longer applies. A chain change also clears
  // the amount, because the same string means something else at different decimals.
  assert.match(panel, /function reset\(keepAmount = false\)/);
  assert.match(panel, /source = chain;\s*\n\s*reset\(\);/);
  assert.match(panel, /dest = chain;\s*\n\s*reset\(\);/);
});

test("choosing a new target does not clear the amount", () => {
  // The user picked an amount, went back to choose a different token to receive,
  // and had to retype a number they had already decided on.
  assert.match(
    panel,
    /targetTokenId = e\.detail;\s*\n(\s*\/\/[^\n]*\n)*\s*reset\(true\);/,
  );
});

test("the token search waits for typing to stop", () => {
  // Typing "shitzzu" is seven keystrokes, and each was a live query against a
  // public API, so one search cost up to seven round trips.
  assert.match(panel, /const SUGGEST_DEBOUNCE_MS = \d+;/);
  assert.match(panel, /suggestDebounce = setTimeout/);
  assert.match(panel, /clearTimeout\(suggestDebounce\)/);
});

test("a search with results does not say nothing matched", () => {
  // The "no results" branch fired on *having a query* rather than on having no
  // results, so a successful search was reported as a failed one.
  const list = readFileSync(TARGET_LIST, "utf8");
  assert.match(list, /query && !searching && visible\.length === 0/);
});

test("both chain pickers sit inside their own From and To card", () => {
  // Four stacked blocks — both chain pickers, then both token lists — put the
  // chain being paid from directly above the chain being paid to, with each one's
  // tokens somewhere else. Choosing a chain and a token on it is one decision.
  assert.match(panel, /bare\s*\n\s*label="From"/);
  assert.match(panel, /bare\s*\n\s*label="To"/);
  // And "Pay with" / "Receive" are retired, since From and To say the same thing.
  assert.match(panel, /showHeading=\{false\}/);
});

test("the source token label never falls back to a raw mint", () => {
  // The wallet reports native SOL under its wrapped mint, so the mint is the only
  // identifier available for it. Rendering it as the label answers "SOL" in the
  // list with a 44-character address.
  assert.match(
    panel,
    /source === "solana"\s*\?\s*\(sourceWalletToken\?\.symbol \?\? "SOL"\)/,
  );
  assert.doesNotMatch(panel, /\{option\.id\}\s*—/);
  assert.doesNotMatch(sourceList, /\{option\.id\}/);
});

test("the resolved symbol is passed into the search, not thrown away", () => {
  // The bug this closes: the list showed "SOL" correctly, but the route readout
  // and the step titles were built from the address alone, so they said
  // `So1111…1112`. The search only ever sees the mint, so the symbol the wallet
  // already resolved has to be handed to it explicitly.
  // The declaration lives on the search's input, the hand-off on the call site.
  assert.match(search, /sourceSymbol\?: string;/);
  assert.match(panel, /^\s*sourceSymbol,$/m);
  assert.match(
    search,
    /sourceSymbol: sourceSymbol \?\? labelFor\(sourceTokenId, registry\)/,
  );
});

test("each chain end's address comes from its own chain", () => {
  // These were both derived from `source`, so changing the From chain rewrote the
  // To card's address even when To did not move. The destination has no idea which
  // end the user changed.
  const code = panel
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.match(
    code,
    /senderAddress =\s*source === "solana" \? \$publicKey\$\?\.toBase58\(\)/,
  );
  assert.match(
    code,
    /recipientAddress =\s*dest === "solana" \? \$publicKey\$\?\.toBase58\(\)/,
  );
});

test("the token list is one list, and flush to its left edge", () => {
  // The sections split the list along a line nobody asked about, and the dead
  // strip down the left came from inheriting a `ul` padding from a global reset.
  // Comments are stripped first: the component explains the removal in prose.
  const markup = targetList
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(markup, /Bridged tokens/);
  assert.doesNotMatch(markup, /In your wallet/);
  assert.match(markup, /class="list-none p-0 m-0/);
});

test("the NEAR source list is real holdings, not just native NEAR", () => {
  // It used to offer one token on the NEAR side however much the account held.
  assert.match(panel, /loadNearHoldings/);
  assert.match(panel, /ftBalances/);
  assert.doesNotMatch(panel, /selectedId="near"/);
  assert.doesNotMatch(panel, /nearBalanceRaw/);
});

test("tokens are listed with an icon, a balance and a USD value", () => {
  assert.match(sourceList, /option\.icon/);
  assert.match(
    sourceList,
    /formatTokenBalance\(option\.balance, option\.decimals\)/,
  );
  assert.match(sourceList, /formatUsd\(option\.usdValue\)/);
  // A token with no route is flagged rather than hidden, because it is still
  // selectable and the user should know why it may fail.
  assert.match(sourceList, /!option\.routable/);
  assert.match(sourceList, /no route/);
});

test("targets are a list with icons and prices, not a collapsed dropdown", () => {
  // Through `iconOf`, not `option.icon` directly: artwork is fetched for the rows
  // the list actually renders, so a token's icon is the catalogue's if it has one
  // and a lookup's if it does not.
  assert.match(targetList, /iconOf\(option\)/);
  assert.match(targetList, /priceOf/);
  // The target picker is where the "any to any" promise is kept or broken.
  assert.doesNotMatch(panel, /<select/);
  assert.doesNotMatch(panel, /<option /);
});

test("both chain cards show their chain icon", () => {
  assert.match(end, /CHAINS\[chain\]\.icon/);
  assert.match(end, /CHAINS\[network\]\.icon/);
  // The amount field carries the token's icon too, so the unit is unambiguous.
  assert.match(panel, /src=\{sourceIcon\}/);
});

test("the amount field has quick-fill steps and a USD hint", () => {
  assert.match(panel, /#each PERCENTS as pct/);
  // The hint prices the amount with the token's *price*. It was given the
  // holding's total value instead, so a wallet with 2.00579 NEAR worth $10.81
  // showed "1.00 NEAR ≈ $10.85" — off by the balance, and disagreeing with the
  // list row right beside it, which is what made the price look simply wrong.
  assert.match(panel, /usdFor\(amount, sourceDecimals, sourcePrice\)/);
  assert.doesNotMatch(panel, /usdFor\(amount, sourceDecimals, sourceUsd\)/);
  assert.match(panel, /text-3xl/);
});

test("every message the form can show is rendered, not just the happy path", () => {
  assert.match(panel, /gate\.insufficientBalance/);
  assert.match(panel, /gate\.insufficientGas/);
  assert.match(panel, /gate\.tooSmall/);
  assert.match(panel, /gate\.noRoute/);
  assert.match(panel, /searchFailed/);
});

test("EVM is not offered as a conversion chain", () => {
  // No EVM chain has liquidity in a token this bridge can deliver, so a
  // conversion to one could be priced and never complete. The Bridge tab still
  // reaches them.
  assert.deepEqual([...CONVERT_CHAINS], ["near", "solana"]);
  assert.doesNotMatch(end, /base|arbitrum|ethereum|bnb/);
});

test("clearing the search forgets the query, not just the results", () => {
  // The picker shows the whole catalogue again as soon as the box is empty, so a
  // search set left behind put the list and the selection on different sets — and
  // the stale one could win, replacing the user's token with the first hit of a
  // search they had just erased.
  const body = panel.slice(panel.indexOf("async function runSuggest"));
  const emptyBranch = body.slice(0, body.indexOf("const controller"));
  assert.match(emptyBranch, /suggestions = \[\]/);
  assert.match(emptyBranch, /suggestFor = ""/);
});

// Progress must not run ahead of what has actually been signed.

test("a progress event starts the step it names rather than ending the previous one", () => {
  // The old code advanced on each event. Since an event named the leg about to
  // run, advancing on it meant the step was already ticked off: the bridge showed
  // as complete while the wallet was still open and nothing had been signed. That
  // is the difference between "this step is starting" and "the last one finished".
  // Component scope, not a local of `startTransfer`: the second press of a
  // NEAR conversion advances the same list from outside that call.
  assert.match(panel, /function begin\(id: string\)/);
  assert.match(panel, /if \(leg === "swap"\) begin\("swap-in"\);/);
  assert.match(panel, /if \(leg === "bridge"\) begin\("bridge"\);/);
  assert.match(panel, /begin\("swap-out"\);/);
  // And nothing is active before the first event, rather than step zero being
  // assumed to be under way.
  assert.match(panel, /activeStep = -1;\s*\n\s*stepFailed = false;/);
});

test("a dismissed wallet popup leaves the form usable", () => {
  // Closing the popup is the common failure: the user changed their mind. It
  // rejects exactly like a failed transfer, and `isSubmitting` used to be derived
  // from the step index, so the button stayed disabled with a spinner and no way
  // back except a reload.
  assert.match(
    panel,
    /"running"[\s\S]*"awaiting-final"[\s\S]*"done"[\s\S]*"failed"/,
  );
  assert.match(panel, /\$: isSubmitting = transferState === "running";/);
  assert.match(panel, /transferState = "failed";/);
  // Editing the form clears it, so a retry never inherits a dead submission.
  assert.match(panel, /transferState = "idle";/);
});

test("no bridge fee row on a route with no bridge in it", () => {
  // A same-chain swap is charged by the DEX, whose cost is already inside the
  // quoted output. Showing a bridge fee there is a contradiction on screen, and a
  // zero or a dash is no better than the row that should not exist.
  assert.match(panel, /\{#if best\.kind !== "swap" && best\.rail\}/);
});

test("the search is given the target's decimals, not left to guess 18", () => {
  // The whole-token check measures the output against 10^decimals. The receive
  // picker holds the target's own decimals and the registry only holds them for
  // the tokens the bridge carries, so without this every other target was checked
  // against 18 — and a Solana USDC conversion, quoting 122,042,006 units, was
  // discarded for arriving "less than one whole token" of 10^18. That is what
  // made Solana routing look broken while the bridge assets worked.
  assert.match(panel, /targetDecimals: target\?\.decimals/);
  const search = readFileSync(SEARCH, "utf8");
  assert.match(search, /known !== undefined && Number\.isInteger\(known\)/);
});

test("the destination swap waits for the bridge to finalise", () => {
  // The reported bug, in the order the code runs. The swap spent tokens the
  // recipient did not have yet, so the balance was zero, the aggregator had
  // nothing to quote, and the second leg reported the target route as gone while
  // the first leg was still in the air. The step list made it look like the
  // bridge had completed and the swap had failed.
  const deposit = panel.indexOf("await runFromSolana({");
  const wait = panel.indexOf("await waitForTransfer({");
  const swapOut = panel.indexOf('begin("swap-out")');
  assert.ok(deposit > 0, "the deposit is signed first");
  assert.ok(wait > deposit, "the bridge is then waited on");
  assert.ok(swapOut > wait, "and the swap only starts after it has finalised");
});

test("the wait is the bridge's API, not a balance polled over RPC", () => {
  // Asking the chain whether the money is there is the wrong question to ask
  // repeatedly: it cannot distinguish "in flight" from "arrived", it costs an RPC
  // call per poll, and on NEAR it is the reason the app has two balance readers.
  // The bridge already publishes the transfer's phase, and the native panel has
  // always read it from there.
  assert.match(
    panel,
    /import \{ phaseOf, waitForTransfer \} from "\$lib\/bridge\/status";/,
  );
  // A Solana deposit is found by its signature. A NEAR one is found by whichever of
  // the two handles it has, and the transaction hash is preferred: it needs nothing
  // parsed out of a receipt log, and the nonce only exists when the Omni SDK
  // managed to find its `InitTransferEvent` — which is not always.
  assert.match(panel, /txHash: solana\.signature/);
  assert.match(panel, /\{ txHash: near\.txHash \}/);
  assert.match(panel, /nonce: near\.originNonce!/);
  // And a transfer that is indexed but not finalised stops rather than spending.
  assert.match(panel, /phaseOf\(transfer\) !== "finalised"/);
});

test("a timed-out or unfinished wait does not claim the transfer failed", () => {
  // The deposit is signed and the funds are on the bridge. "The transfer failed"
  // would be a lie, and it is the difference between a user refreshing and a user
  // believing their money is gone.
  assert.match(panel, /The bridge has not finalised yet/);
  assert.match(panel, /funds are on their way/);
});

test("the wait is visible, because it is the longest silent part", () => {
  // Minutes with nothing happening on-chain that the user can see. A spinner on a
  // step that looks stalled is indistinguishable from a hang.
  assert.match(panel, /Bridge \{waitingForBridge\.phase\}/);
  assert.match(panel, /phase, attempt, total/);
});

test("a NEAR source with a swap splits into two presses", () => {
  // Each leg is its own wallet interaction and the second happens after the user has
  // committed, so batching them spent the one gesture on everything and left the
  // deposit nothing to answer. It also shrinks the bridge's batch to just the
  // storage deposit and the locker call, which is where a missing
  // `InitTransferEvent` almost certainly means the wallet withheld the logs rather
  // than that the deposit failed.
  assert.match(
    panel,
    /if \(source === "near" && runningPlan\.sourceSwap\)/,
    "and it branches on the plan that was signed, not the derived one",
  );
  assert.match(panel, /swapLeg = await runNearSourceSwap\(\{/);
  assert.match(panel, /transferState = "awaiting-deposit";/);
  // The button dispatches the parked press rather than starting a new transfer. This
  // was an inline ternary; it is a block now because a finished transfer's press has to
  // be handled before it, and a chain of ternaries is where that sort of thing goes to
  // be missed.
  assert.match(panel, /if \(transferState === "awaiting-deposit"\)/);
  assert.match(panel, /return runDepositPress\(\);/);
  assert.match(panel, /if \(transferState === "awaiting-final"\)/);
  assert.match(panel, /return runFinalSwap\(\);/);
  // The deposit is signed with no additional transactions: the swap is already done.
  const nearSrc = readFileSync("src/bridge/executeNear.ts", "utf8");
  // Scoped to the deposit's own `initTransfer` call rather than to a function
  // slice: the legacy straight-bridge path below still passes
  // `additionalTransactions`, correctly, because it has no swap to have run.
  const call = nearSrc.indexOf("export async function runNearDeposit");
  const submit = nearSrc.indexOf("client.initTransfer(", call);
  const deposit = nearSrc.slice(submit, submit + 500);
  assert.ok(submit > call, "the deposit signs the bridge transaction");
  // The swap is already signed and settled, so it is not bundled in again. The one
  // thing that *is* added is the wrap, and only when the swap delivered native NEAR
  // — the split's whole point is that the batch is the storage deposit, the locker
  // call, and at most that one wrap.
  assert.doesNotMatch(deposit, /swapTransactions/);
  assert.match(
    nearSrc,
    /wrap \? \{ additionalTransactions: \[wrap\] \} : \{\}/,
  );
});

test("the deposit reads the swap's outcome from both the transaction and the balances", () => {
  // The transaction is read for one thing: whether it reverted. A panicking call emits
  // no events, so a failed swap's log list is empty, and a reader that only looks for
  // arrivals concludes the swap delivered nothing rather than that it failed.
  const near = readFileSync("src/bridge/executeNear.ts", "utf8");
  assert.match(
    near,
    /receivedInTransaction\(\s*swap\.txHash,\s*swap\.accountId,/,
  );
  assert.match(near, /if \(reverted\)/);
  assert.match(near, /The swap did not go through: \$\{reverted\}/);

  // The *amount* cannot come from the transaction, because a plain NEAR transfer emits
  // no event: the logs see the wrapped form and are structurally blind to the native
  // one. So both balances are sampled, and both are used.
  assert.match(near, /tokenBalanceOf\(swap\.railToken, swap\.accountId\)/);
  assert.match(near, /nativeBalanceOf\(swap\.accountId\)/);

  // A form the swap also spent cannot be measured as a gain — its balance moved down
  // too, so the difference is net of both.
  assert.match(near, /swap\.spentToken !== swap\.railToken/);
  assert.match(near, /swap\.spentToken !== NEAR_NATIVE/);

  // Native is wrapped rather than treated as equivalent to the wrapped contract.
  assert.match(near, /ft_on_transfer/);
  // And the failure names both forms, since naming only the wrapped contract is wrong
  // whenever the payout would have been native.
  assert.match(near, /Neither \$\{swap\.railToken\} nor native NEAR grew/);
});

test("the swap's baseline is taken before the swap is signed", () => {
  // A baseline sampled afterwards is a comparison between two moments that are both
  // after the event, and therefore says nothing at all.
  const near = readFileSync("src/bridge/executeNear.ts", "utf8");
  const baseline = near.indexOf("const before = {");
  const signed = near.indexOf("signNearTransactions(");
  assert.ok(baseline > 0 && signed > 0, "both are present");
  assert.ok(
    baseline < signed,
    "the balances are read before the swap is sent, not after",
  );
});

test("the swap's result is kept between the two presses, and not after a reset", () => {
  assert.match(panel, /let swapLeg: NearSwapLeg \| null = null;/);
  assert.match(panel, /swapLeg = null;/);
  // And a second press with nothing to work from says so rather than guessing.
  assert.match(panel, /if \(!swapLeg\)/);
  assert.match(panel, /The swap's result is unknown/);
});

test("both source paths still exist, and each reports only what it signs", () => {
  // A straight NEAR bridge with no swap is a single transaction and needs no split.
  assert.match(panel, /await runFromNear\(\{/);
  // Solana still advances leg by leg; NEAR only marks the swap, because the
  // deposit is now a separate press.
  assert.match(
    panel,
    /if \(leg === "swap"\) begin\("swap-in"\);\s*\n\s*if \(leg === "bridge"\) begin\("bridge"\);/,
  );
});

test("a late failure says the bridge worked and the money is in the account", () => {
  // "The transfer failed" would be a lie: the deposit succeeded. It is the
  // difference between a user who swaps from the token list and a user who thinks
  // their funds are stuck in the bridge.
  assert.match(panel, /\[bridge\] final swap failed/);
  assert.match(panel, /Your funds have arrived — swap from the token list/);
});

test("parking on the swap step marks the bridge done, not spinning", () => {
  // The reported symptom: the bridge had finalised and "What happens" still showed
  // a spinner on it. Parking without moving the pointer left the *bridge* as the
  // active step, which is the app contradicting the chain about whether the money
  // arrived.
  const park = panel.indexOf('transferState = "awaiting-final"');
  const begin = panel.indexOf('begin("swap-out")', park);
  assert.ok(park > 0, "it parks");
  assert.ok(
    begin > park,
    "and advances to the swap step so the bridge reads done",
  );
  // With the step marked as waiting rather than running, since nothing is in flight.
  assert.match(
    panel,
    /withProgress\(\s*steps,\s*activeStep,\s*stepFailed,\s*transferState === "awaiting-final" \|\|/,
  );
});

test("a finished leg stops saying it is converting", () => {
  // The banner came from the swap's own progress callback and nothing took it
  // down on success, so a completed swap left "Converting on Near" and a spinner
  // under a plan that had already finished.
  assert.match(panel, /transferMessage = null;\s*\n\s*transferState = "done";/);
});

test("a NEAR source does not tick its bridge before the deposit is signed", () => {
  // The bridge step must not be ticked by the swap's press at all: the deposit is a
  // second signature, and a checkmark on it before then is a checkmark on a transfer
  // that does not exist — which is exactly the report this came from.
  const nearHandler = panel.slice(
    panel.indexOf("await runFromNear({"),
    panel.indexOf(
      'if (source === "near") {',
      panel.indexOf("await runFromNear({"),
    ),
  );
  assert.doesNotMatch(nearHandler, /begin\("bridge"\)/);
  assert.match(nearHandler, /begin\("swap-in"\)/);
  // While the swap is being assembled nothing may advance to the bridge: that is the
  // checkmark on an unsigned step.
  const assembling = panel.slice(
    panel.indexOf("swapLeg = await runNearSourceSwap({"),
    panel.indexOf('begin("bridge");\n        transferState'),
  );
  assert.doesNotMatch(assembling, /begin\("bridge"\)/);
  assert.match(assembling, /begin\("swap-in"\)/);
  // And once it is signed, the park advances to the bridge — which is what is
  // waiting — so the finished swap reads as done rather than pending.
  assert.match(
    panel,
    /begin\("bridge"\);\s*\n\s*transferState = "awaiting-deposit";/,
  );
  // Both parked states render the step as waiting rather than running.
  assert.match(
    panel,
    /transferState === "awaiting-final" \|\|\s*transferState === "awaiting-deposit",/,
  );
});

test("a Solana source still advances leg by leg", () => {
  // The two chains are genuinely different here: Solana signs a swap and a deposit
  // separately, so each can be reported as it happens.
  const solanaHandler = panel.slice(
    panel.indexOf("await runFromSolana({"),
    panel.indexOf("await runFromNear({"),
  );
  assert.match(solanaHandler, /begin\("swap-in"\)/);
  assert.match(solanaHandler, /begin\("bridge"\)/);
});

test("a recalculation forgets the previous attempt", () => {
  // Typing an amount after a run ended in an error used to leave that run's message
  // and its red step on screen under a route that had never been attempted — the app
  // reporting a failure for something the user had not tried.
  assert.match(
    panel,
    /async function runSearch\(\) \{[\s\S]*?if \(transferState !== "running"\) clearAttempt\(\);/,
  );
  // Both ways a route stops being current: a recalculation, and a form that cannot be
  // priced at all.
  assert.equal(
    (panel.match(/if \(transferState !== "running"\)/g) ?? []).length,
    2,
  );
});

test("clearing the attempt drops every trace of the previous one", () => {
  // One definition, so the error state cannot be forgotten in one place and reset in
  // another — the failed step, the message, the parked amounts and the submission
  // state all travel together.
  const body = panel.slice(
    panel.indexOf("function clearAttempt()"),
    panel.indexOf("function reset("),
  );
  for (const field of [
    "activeStep = -1",
    "stepFailed = false",
    "transferDone = false",
    "transferError = null",
    "waitingForBridge = null",
    "transferMessage = null",
  ]) {
    assert.ok(body.includes(field), `${field} is not cleared`);
  }
  // The chain facts are cleared only when the swap is no longer the right one, so
  // they cannot be wiped unconditionally.
  assert.match(body, /if \(!swapStillApplies\) \{[\s\S]*?landedAmount = null;/);
  assert.match(body, /if \(!swapStillApplies\) \{[\s\S]*?swapLeg = null;/);
  // And nothing in flight is disturbed.
  assert.match(panel, /if \(transferState !== "running"\) clearAttempt\(\);/);
});

// A signed swap is a fact about the chain, not a value in this form.

test("a recalculation does not delete a swap that has been signed", () => {
  // The report this fixes: the router was spammed after a swap that had worked, and
  // the bridge was never offered. The swap was cleared on every re-pricing, so the
  // park went with it, the button fell back to "Convert", and pressing it swapped
  // again. A keystroke cannot un-sign a transaction.
  const body = panel.slice(
    panel.indexOf("function clearAttempt()"),
    panel.indexOf("function reset("),
  );
  assert.match(
    body,
    /const swapStillApplies =\s*\n?\s*swapLeg !== null && amount !== null && amount === swapLeg\.forAmount;/,
  );
  // And the park survives with it, because a signed swap with nothing bridged is a
  // real position the button still has to act on.
  assert.match(body, /transferState = "awaiting-deposit";/);
  assert.match(body, /begin\("bridge"\);/);
});

test("a swap is only kept while it is still the right swap", () => {
  // Valid for the amount it actually swapped. Keeping it across an amount change
  // would bridge a stale number, which is worse than re-swapping.
  const body = panel.slice(
    panel.indexOf("function clearAttempt()"),
    panel.indexOf("function reset("),
  );
  assert.match(body, /if \(!swapStillApplies\) \{[\s\S]*?swapLeg = null;/);
  // And the swap records what it was for.
  const near = readFileSync("src/bridge/executeNear.ts", "utf8");
  assert.match(near, /forAmount: amount,/);
  assert.match(near, /forAmount: bigint;/);
});

test("a search quote gets one attempt, an execution gets the full budget", () => {
  // Persistence proportional to what is at stake. A search is speculative and scores
  // seven rails at once, so losing one to a cold router costs it nothing; a leg with
  // a signature behind it does not have that freedom. Seven rails times two legs
  // times three attempts is forty requests on a 400ms debounce.
  const agg = readFileSync("src/bridge/aggregators.ts", "utf8");
  assert.match(agg, /const SEARCH_ATTEMPTS = 1;/);
  // A default rather than an override, so a caller that asks for more still gets it.
  assert.match(agg, /attempts: routing\.attempts \?\? SEARCH_ATTEMPTS/);
  // The execution legs still get the default budget.
  const near = readFileSync("src/bridge/executeNear.ts", "utf8");
  assert.match(near, /getIntearRoutesRouted\(\{/);
  assert.doesNotMatch(near, /attempts: SEARCH_ATTEMPTS/);
});

test("a destination change empties the list instead of leaving the old one up", () => {
  // The spinner is honest about being a spinner only if the list under it is empty.
  // Otherwise a destination that is still loading shows the chain it *was*, with
  // tokens that mean nothing on the one now selected — and a Solana mint can be
  // picked for NEAR, which is then a route that cannot exist.
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  const load = body.slice(
    body.indexOf("async function loadCatalog("),
    body.indexOf("$: if (dest !== catalogFor)"),
  );
  const clears = load.indexOf("catalog = [];");
  const fetches = load.indexOf("await buildCatalog(");
  assert.ok(clears > 0, "the list is cleared");
  assert.ok(
    clears < fetches,
    "and cleared before the fetch, not after it resolves",
  );
});

test("an all-empty search is asked again, because the router is sometimes just cold", () => {
  // The Intear router returns `[]` for a pair that routes moments later, at 10–30%.
  // Seven rails all empty is one cold window seen seven times, and reporting that as
  // "no route available" is a lie about a live market. This used to be promised in a
  // comment in `intear.ts` and never built.
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  assert.match(body, /worthRetryingEmpty/);
  // The whole budget, not one re-run: at a 30% empty rate two searches still fail
  // 9% of the time. `EMPTY_RETRY_DELAYS_MS` is four, so five searches and a failure
  // rate of 0.3^5.
  assert.match(body, /attempt < EMPTY_RETRY_DELAYS_MS\.length/);
  assert.match(body, /emptyRetryDelay\(attempt\)/);
  // And only after a real wait: thirty identical requests fired back to back produced
  // six consecutive empties, so an immediate retry is not a retry.
  assert.match(body, /await sleep\(wait, signal\)/);
  // The empty result is not published on the way past, or the form would show a route
  // it does not have while it waits.
  assert.doesNotMatch(
    body.slice(
      body.indexOf("let result = await runOneSearch();"),
      body.indexOf("search = result;"),
    ),
    /search = result/,
  );
});

test("a per-rail search retry stays at one attempt", () => {
  // Guarding against the obvious "fix": raising the per-rail budget multiplies
  // requests on a 400ms debounce and provably does not help, because the retries land
  // inside the same cold window. The search's own retry is the retry.
  const source = readFileSync("src/bridge/aggregators.ts", "utf8");
  assert.match(source, /const SEARCH_ATTEMPTS = 1;/);
  // And a leg with a signature behind it still gets the full budget.
  const intear = readFileSync("src/near/intear.ts", "utf8");
  assert.match(intear, /const ROUTE_ATTEMPTS = 5;/);
  assert.match(intear, /const ROUTE_BACKOFF_MS = \[500, 1000, 1500, 2000\]/);
});

test("a superseded search stops waiting instead of sitting out its delay", () => {
  // The waits are seconds long, so a plain `setTimeout` would keep a superseded
  // search alive for its full delay after the user had already changed the amount —
  // the new search runs and the old one lingers holding a spinner it has no right to.
  // This is what makes a long retry budget affordable at all.
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  assert.match(body, /searchingAbort\?\.abort\(\)/);
  assert.match(body, /searchingAbort = new AbortController\(\)/);
  assert.match(body, /clearTimeout\(timer\)/, "the wait itself is cancellable");
  assert.match(
    body,
    /signal\.aborted\) return;/,
    "and checked before each attempt",
  );
});

test("a transfer that has begun pauses the search", () => {
  // Clicking the button used to re-fetch every quote, and a NEAR source used to have
  // its swap re-checked after the swap was already signed. Both are the same bug: the
  // search was only ever guarded for the sake of `clearAttempt`, never for its own sake.
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  const pause = body.slice(
    body.indexOf("$: searchPaused ="),
    body.indexOf("onDestroy(() => clearTimeout(debounce))"),
  );
  for (const state of ["running", "awaiting-deposit", "awaiting-final"]) {
    assert.match(
      pause,
      new RegExp(`transferState === "${state}"`),
      `${state} pauses the search`,
    );
  }
  assert.match(
    pause,
    /formPriceable && !searchPaused/,
    "and nothing else re-arms it",
  );
});

test("pausing keeps the plan on screen, because the second press is built from it", () => {
  // `runDepositPress` signs against `best`, which comes from `search`. Clearing the
  // search on pause would leave the deposit with nothing to sign — so paused has to
  // mean "stop asking", not "forget what you were told".
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  const block = body.slice(
    body.indexOf('} else {\n    searchTrace("not searching"'),
    body.indexOf("onDestroy(() => clearTimeout(debounce))"),
  );
  const clearing = block.indexOf("search = null;");
  const guarded = block.indexOf("if (!formPriceable)");
  assert.ok(clearing > 0, "there is a clearing branch");
  assert.ok(guarded > 0, "and it is conditional");
  assert.ok(
    guarded < clearing,
    "the search is only cleared when the form is unpriceable, not when it is paused",
  );
  // And the deposit really does read a plan: the one captured at submit, so a search
  // landing mid-transfer cannot swap a different rail in underneath it.
  assert.match(body, /plan: runningPlan!/);
  assert.match(body, /\$: best = plans\.find/);
});

test("a NEAR source is not re-quoted between its two presses", () => {
  // The state the whole pause exists for. `awaiting-deposit` means the swap is signed
  // and the account already holds the rail, so re-pricing asks for a leg that is done
  // — and an empty answer for it would report no route on a form that is halfway
  // through a working transfer.
  const gate = readFileSync("src/bridge/convertGate.ts", "utf8");
  assert.match(
    gate,
    /else if \(awaitingDeposit\) label = "Bridge to the destination chain"/,
  );
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  assert.match(body, /transferState = "awaiting-deposit"/);
  assert.match(body, /transferState === "awaiting-deposit"/);
});

test("the pause lifts when the form moves on, so a new route can be derived", () => {
  // The pause is scoped to "the same question". Change the amount or the target
  // mid-transfer and the plan on screen is no longer the plan for what the user is
  // now asking — `clearAttempt` already re-parks on the understanding that the bridge
  // and destination swap are re-derived, which cannot happen without a search.
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  assert.match(body, /!formChangedSincePricing/);
  assert.match(body, /pricedFor = result\.plans\.length/);
  // An empty result is the cold router, not a price, so it is not recorded as one.
  assert.match(
    body,
    /\?\s*\{ amount: amount \?\? 0n, target: pricedTargetKey \}/,
  );
  // And forgetting the form forgets what it was priced for.
  assert.match(body, /pricedFor = null;/);
});

test("the pause does not depend on pricedFor through a reactive statement", () => {
  // Svelte closes a cycle when a `$:` reads what the search trigger writes. Reading it
  // through a function is the seam, and it is load-bearing: inlining it makes
  // `searchPaused` re-trigger the very search whose result it is recording.
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  assert.match(body, /function formMovedSincePricing\(/);
  const statement = body.slice(
    body.indexOf("$: formChangedSincePricing ="),
    body.indexOf("$: formChangedSincePricing =") + 120,
  );
  assert.doesNotMatch(
    statement,
    /pricedFor\b/,
    "the derived statement names only the function",
  );
});

test("the search trigger names the raw inputs, not only the booleans derived from them", () => {
  // Svelte re-runs a `$:` when a dependency is *assigned a different value*. A boolean
  // that recomputes to `true` is not a change, so a trigger written against derived
  // booleans re-runs only when one of them flips — and editing an amount from 1 to 2
  // recomputes both to the values they already held. The route then stops
  // recalculating on a keystroke.
  //
  // This is invisible to svelte-check and to the unit tests, because the code is valid
  // and the failure is an omission rather than an error. That is why it is pinned here
  // at all: the condition reads exactly as it did before it broke, so nothing about
  // reading the file would show a reviewer that the inputs are load-bearing.
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  const start = body.indexOf("$: if (\n    !searchPaused &&");
  assert.ok(start > 0, "the trigger names searchPaused first");
  const block = body.slice(start, body.indexOf("} else {", start));
  for (const input of [
    "amount !== null",
    "amount > 0n",
    "sourceAddress !== null",
    "targetAddress !== null",
    "senderAddress",
    "recipientAddress",
  ]) {
    assert.match(
      block,
      new RegExp(input.replace("$", "\\$")),
      `${input} is named, so changing it re-runs the block`,
    );
  }
  assert.doesNotMatch(
    block,
    /\bformPriceable\b/,
    "and the derived boolean is not what the trigger keys off",
  );
});

test("the same trap is not set for the pause-lifting check", () => {
  // `formChangedSincePricing` decides whether a paused search is released, so it has to
  // re-run when the amount changes too. It gets this right by naming `amount` in the
  // statement rather than hiding it inside the comparison.
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  const start = body.indexOf("$: formChangedSincePricing =");
  const statement = body.slice(start, body.indexOf(";", start) + 1);
  assert.match(
    statement,
    /amount/,
    "the amount is named in the statement, not only inside the function",
  );
});

test("the token list waits for the URL, and is rebuilt when the balances move", () => {
  // Two separate reasons to build, and the second is the fix for balances that never
  // appeared on the receive side. That list is *built* with the balances folded in and
  // then held — unlike the spend side, which is derived and re-renders — so a wallet
  // read landing after the build used to change nothing here, and the amounts stayed
  // absent. Toggling the destination was the only thing that made it rebuild, which is
  // why it looked like the chain switch was the fix.
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  assert.match(body, /shouldBuildCatalog\(\{/);
  assert.match(body, /builtFrom: catalogHeldFor/);
  assert.match(body, /signature: heldSignature/);
  // The decision itself is tested in `bridgeWalletLoad`; this is the wiring.
  assert.match(body, /catalogHeldFor = heldSignature;/);
  // `hydrated` is only set after the `onMount` that reads the query, so `dest` is
  // already the chain the link asked for. Building before that asks for the *default*
  // chain, and the aborted first request comes back empty and overwrites the list the
  // link asked for.
  const hydrated = body.indexOf("hydrated = true;");
  const readsQuery = body.indexOf("source = initial.from;");
  assert.ok(hydrated > 0 && readsQuery > 0, "both are set on mount");
  assert.ok(
    readsQuery < hydrated,
    "and the query is read before the list is allowed to load",
  );
});

test("a rebuild for fresh balances does not blank the list", () => {
  // The same rows with amounts added, rather than a different set of rows. Blanking it
  // there flashes the list empty every time the wallet finishes loading, and the sort
  // by held value moves rows around underneath the user's finger besides.
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  const start = body.indexOf("async function loadCatalog(");
  const fn = body.slice(start, body.indexOf("\n  }\n", start));
  assert.match(fn, /if \(catalogFor !== chain\) \{/);
  // And the chain is recorded after the comparison, not before it, or the comparison
  // would be against itself and would never fire.
  const check = fn.indexOf("if (catalogFor !== chain) {");
  const assign = fn.indexOf("catalogFor = chain;");
  assert.ok(check > 0 && assign > check, "the comparison comes first");
});

test("only the current list request may write the list", () => {
  // An aborted request resolves empty rather than rejecting — `getJson` swallows the
  // abort so one dead section cannot break the picker — so a superseded load comes
  // back *normally* and overwrites whatever replaced it. The `finally` already checked
  // controller identity; the success and failure paths that write `catalog` did not.
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  const start = body.indexOf("async function loadCatalog(");
  const fn = body.slice(start, body.indexOf("\n  }\n", start));
  // Three writes: the clear on entry, and the two that land after an await. Only the
  // latter can belong to a superseded request, and those are the two that are guarded.
  const writes = [...fn.matchAll(/^\s*catalog = /gm)].length;
  const guards = [...fn.matchAll(/if \(catalogAbort !== controller\) return;/g)]
    .length;
  assert.equal(writes, 3, "a clear on entry, and the two awaited writes");
  assert.equal(
    guards,
    2,
    "and both awaited writes are behind a controller-identity guard",
  );
  // And the clear on entry comes before anything is awaited, where it cannot be stale.
  const clear = fn.indexOf("catalog = [];");
  const firstAwait = fn.indexOf("await buildCatalog(");
  assert.ok(
    clear > 0 && firstAwait > clear,
    "the clear happens first, synchronously",
  );
});

test("a wallet read that keeps failing is retried inside the loader", () => {
  // The guard cannot do this: it re-runs only when a value it depends on changes, and
  // a read that produces nothing changes neither. The decision itself is tested in
  // `bridgeWalletLoad`; what is asserted here is that the retry lives where an attempt
  // actually happens, and that it is keyed on the *result* rather than on `catch`.
  //
  // `fetchWalletTokens` cannot fail loudly — each token-program read is caught and
  // answered with an empty list, and the native balance has its own `.catch(() => 0)`
  // — so a rejected RPC arrives as a successful read of an empty wallet, and a retry
  // written in terms of `catch` never fires.
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  const start = body.indexOf("async function loadSolanaTokens(");
  const fn = body.slice(start, body.indexOf("\n  }\n", start));
  assert.match(
    fn,
    /if \(found\.length === 0\)/,
    "the result is what is inspected",
  );
  assert.match(fn, /continue;/, "and an empty result asks again");
  assert.match(body, /const WALLET_LOAD_ATTEMPTS = 3;/);
  assert.match(
    fn,
    /attempt < WALLET_LOAD_ATTEMPTS/,
    "bounded, and the last is believed",
  );
  assert.match(
    fn,
    /if \(!sameWallet\(\)\) return;/,
    "and it gives up if the user moved on, rather than writing for a stale account",
  );
});

test("the loading flag always comes down", () => {
  // Gating it on the wallet left it stuck at `true` whenever the account changed
  // mid-load, and `loading={isLoadingSolanaTokens}` then put a spinner where the
  // balances should be — for the rest of the session, indistinguishable from a read
  // still in progress.
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  const start = body.indexOf("async function loadSolanaTokens(");
  const fn = body.slice(start, body.indexOf("\n  }\n", start));
  assert.doesNotMatch(
    fn,
    /if \(sameWallet\(\)\) isLoadingSolanaTokens = false;/,
    "the flag is not left conditional on the wallet",
  );
  const tail = fn.slice(fn.lastIndexOf("} finally {"));
  assert.match(tail, /isLoadingSolanaTokens = false;/);
});

test("the empty message asks about the source chain's own wallet", () => {
  // This asked "is *either* wallet connected", which is the wrong question and
  // answered itself wrongly. On `?from=near&to=solana` the NEAR wallet is connected and
  // the Solana one is not, so picking Solana as the source chain produced "No tokens
  // found in this wallet" — for a wallet the app had never asked, because the Solana
  // load is gated on the Solana key. A wallet that was never consulted was reported as a
  // wallet with nothing in it, which is why this read as "the balances did not load".
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  assert.match(
    body,
    /source === "near" \? Boolean\(\$accountId\$\) : Boolean\(\$publicKey\$\)/,
  );
  assert.doesNotMatch(
    body.slice(
      body.indexOf("emptyMessage="),
      body.indexOf("emptyMessage=") + 400,
    ),
    /\$accountId\$ \|\| \$publicKey\$/,
    "and no longer treats either wallet as an answer for both chains",
  );
  // And the unconnected case is the one that says so.
  assert.match(body, /"Connect your wallet to see your balances\."/);
});

test("a finished transfer is not re-parked as awaiting a deposit", () => {
  // The bug: `clearAttempt` re-parked whenever a surviving swap existed, which is true
  // until the conversion completes and false afterwards. A recalculation arriving after
  // the final swap — and one does, because the arrival lands in the destination wallet,
  // which is a balance change, which re-prices — turned a finished transfer back into a
  // pending one, and the button went back to offering to bridge money that had arrived.
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  const start = body.indexOf("function clearAttempt()");
  const fn = body.slice(start, body.indexOf("\n  }\n", start));
  assert.match(fn, /if \(transferState === "done"\) \{/);
  // And the park is only re-entered when the transfer is genuinely unfinished.
  const doneGuard = fn.indexOf('if (transferState === "done")');
  const park = fn.indexOf('transferState = "awaiting-deposit"');
  assert.ok(
    doneGuard > 0 && park > doneGuard,
    "the finished case returns before the park",
  );
  // The swap and the landed amount survive, because the receipt is built from them.
  assert.doesNotMatch(
    fn.slice(doneGuard, park),
    /swapLeg = null/,
    "a finished transfer keeps what it produced",
  );
});

test("the receipt reports what arrived, not what was expected", () => {
  // Both destination swaps have always returned the amount they delivered and the panel
  // discarded it, leaving the summary with only the quote's guaranteed figure. The
  // difference between the two is the destination swap's spread, and a receipt is the
  // one place that should not round in the user's favour.
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  const start = body.indexOf("async function runFinalLeg(");
  const fn = body.slice(start, body.indexOf("\n  }\n", start));
  assert.match(
    fn,
    /produced = result\.received;/,
    "both legs' output is captured",
  );
  assert.match(fn, /receivedAmount = produced;/);
  // `landedAmount` is what the bridge paid out *before* the final swap, so preferring it
  // would report the pre-swap arrival as the outcome.
  const start2 = body.indexOf("function showReceipt()");
  const receipt = body.slice(start2, body.indexOf("\n  }\n", start2));
  assert.match(
    receipt,
    /const received = receivedAmount \?\? plan\.receiveAmount;/,
    "the delivered amount wins, and the guaranteed figure is the fallback",
  );
  // Not `landedAmount`: that is the pre-swap arrival, and preferring it would report it
  // as the outcome. Checked on the assignment rather than the whole function, so the
  // comment explaining why is not mistaken for the mistake.
  assert.doesNotMatch(
    receipt.match(/const received = [^;]+;/)?.[0] ?? "",
    /landedAmount/,
    "the pre-swap arrival is never the headline number",
  );
});

test("the receipt is a sheet, and its button resets rather than dispatches into nothing", () => {
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  assert.match(body, /openBottomSheet\(\s*ConversionDone/);
  assert.match(body, /onReset: startAnother/);
  // `openBottomSheet` spreads props and wires no listeners, so a dispatched event would
  // have gone nowhere and the button would have closed the sheet having changed nothing.
  const sheet = readFileSync("src/bridge/ConversionDone.svelte", "utf8");
  assert.match(sheet, /export let onReset/);
  assert.doesNotMatch(sheet, /createEventDispatcher|dispatch\(/);
  // The steps are the plan's own, ticked, so the receipt cannot disagree with the plan
  // it is a receipt for.
  assert.match(sheet, /<RouteSteps steps=\{completed\} \/>/);
});

test("starting over clears what the finished transfer spent", () => {
  // Left as it was, the form reopens on a balance the user no longer has, and the next
  // attempt is refused for the wrong reason — or spends whatever arrived in its place.
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  const start = body.indexOf("function startAnother()");
  const fn = body.slice(start, body.indexOf("\n  }\n", start));
  assert.match(fn, /swapLeg = null;/);
  assert.match(fn, /landedAmount = null;/);
  assert.match(fn, /receivedAmount = null;/);
  assert.match(fn, /transferDone = false;/);
  assert.match(fn, /amountInput = undefined;/);
  assert.match(
    fn,
    /sourceTokenId = source === "solana" \? WSOL_MINT : "near";/,
  );
  assert.match(fn, /reset\(\);/);
});

test("the receive list leads with what the account holds, not with what is priced", () => {
  // USDC sat in the account and did not appear in the list of things to receive.
  //
  // The order was value first, `heldUsd === undefined` last — and on NEAR the picker
  // is not priced at all, so a held token the curated list has never heard of has no
  // value to sort with. It was therefore placed below every token the user does *not*
  // own, and off the screen past the 20-row limit. Held has to be decided before
  // price, not after.
  const catalog = readFileSync("src/bridge/catalog.ts", "utf8");
  const start = catalog.indexOf("return withPrices.sort(");
  const sorter = catalog.slice(start, catalog.indexOf("});", start));
  const heldTest = sorter.indexOf("const aHeld =");
  const valueTest = sorter.indexOf("const ah = a.heldUsd;");
  assert.ok(heldTest > 0 && valueTest > 0, "both are decided");
  assert.ok(
    heldTest < valueTest,
    "held first, and price only orders within a group",
  );
  // And the merge that puts holdings into the list at all is still there, unchanged —
  // the tokens were always present, they were just sorted out of sight.
  assert.match(catalog, /const heldOnly: CatalogToken\[\] = held/);
  assert.match(catalog, /A token the account holds is always offered/);
});

test("the balance counter is bumped after the balances land, on both chains", () => {
  // It was bumped *before* the NEAR request went out, while the Solana one was bumped
  // after its assignment. The counter exists to tell the destination list that what it
  // was built from has changed, so bumping on the way in rebuilt the list against the
  // holdings it already had — on a first load, none — and then nothing said the new
  // ones had arrived. A NEAR destination listed the bridge's assets and none of the
  // wallet's own tokens, while the Solana side was fine. Two chains, one bug, and the
  // asymmetry is exactly what made it hard to see.
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");

  for (const [name, start, assign] of [
    [
      "loadSolanaTokens",
      "async function loadSolanaTokens(",
      "solanaTokens = found;",
    ],
    [
      "loadNearHoldings",
      "async function loadNearHoldings(",
      "nearHoldings = found;",
    ],
  ] as const) {
    const fn = body.slice(
      body.indexOf(start),
      body.indexOf("\n  }\n", body.indexOf(start)),
    );
    const at = fn.indexOf("holdingsVersion += 1;");
    const landed = fn.indexOf(assign);
    assert.ok(at > 0, `${name} bumps the counter`);
    assert.ok(landed > 0, `${name} assigns its balances`);
    assert.ok(at > landed, `${name} bumps only once the balances are in hand`);
  }
});

test("native leads the spend list on both chains", () => {
  // It is the one token the account certainly has, it is what pays the fee, and it is
  // what a conversion opens on — so letting a large holding push it down means the
  // default selection and the thing that must not run out are both below the fold. The
  // NEAR branch always prepended it; Solana relied on the value sort, which does not
  // guarantee it.
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  const start = body.indexOf("function buildSourceOptions(");
  const fn = body.slice(start, body.indexOf("\n  }\n", start));
  assert.match(
    fn,
    /const native = tokens\.filter\(\(t\) => t\.native\);/,
    "native is separated from the value sort",
  );
  assert.match(fn, /\[\.\.\.native, \.\.\.rest\]/);
  // And the NEAR branch is untouched: it already prepended unconditionally.
  assert.match(fn, /\.\.\.native,/, "the NEAR branch still leads with it too");
});

test("a token's artwork comes from its deepest pool", () => {
  // `iconsFor` took the first pair that had any image, while its comment claimed a
  // liquidity ranking it never did. On NEAR that put the Rhea pool's logo on USDC —
  // a venue's icon on a token, which cannot be told from a right one at a glance.
  const dex = readFileSync("src/bridge/dexscreener.ts", "utf8");
  const start = dex.indexOf("export async function iconsFor(");
  const fn = dex.slice(start, dex.indexOf("\n}", start));
  assert.doesNotMatch(
    fn,
    /pairs\.find\(\(pair\) => pair\.info\?\.imageUrl\)/,
    "and never the first pool that happens to have artwork",
  );
});

test("both surfaces that show a token resolve its artwork the same way", () => {
  // JLU and XAUT are in the registry with artwork and have none anywhere else: their
  // on-chain metadata carries no image and no indexer has a pool to take one from.
  //
  // The list rows and the amount field were resolving this separately and disagreed —
  // the rows read the on-chain record, the field read the registry — so a token looked
  // correct next to the amount and blank in the list, on the same screen. The first fix
  // only touched the field, which is why it appeared to do nothing.
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");

  // One helper, and both call it.
  assert.match(body, /function iconFor\(/);
  const options = body.slice(
    body.indexOf("function buildSourceOptions("),
    body.indexOf("\n  }\n", body.indexOf("function buildSourceOptions(")),
  );
  assert.match(
    options,
    /icon: iconFor\(holding\.tokenId, holding\.icon, holding\.symbol\)/,
    "the list rows",
  );
  const field = body.slice(
    body.indexOf("$: sourceIcon ="),
    body.indexOf("$: solBalance"),
  );
  assert.match(
    field,
    /iconFor\(sourceAddress, sourceHolding\?\.icon/,
    "the field",
  );

  // And the helper leads with what the product ships, not the on-chain record.
  const helper = body.slice(
    body.indexOf("function iconFor("),
    body.indexOf("\n  }\n", body.indexOf("function iconFor(")),
  );
  assert.match(helper, /registryIcon\(address, symbol\)/, "the registry leads");
  assert.match(
    helper,
    /onChainIcon \|\|\s*""/,
    "and the on-chain record is the last resort before nothing",
  );
});

test("the registry lookup can fall back to a symbol, and says why that is safe", () => {
  // XAUT's NEAR address is a `factory.bridge.near` contract, the shape a bridged or
  // minted asset arrives in, and an address that reaches the holdings wrapped or
  // rewritten does not match the registry while the token is plainly the same one.
  //
  // A symbol is a weaker key than an address — two tokens can share a ticker, and a
  // wrong icon is worse than a blank one because it cannot be told from a right one. So
  // the fallback is only safe while the registry's symbols are distinct, which is a
  // property of the data and therefore something a test can check.
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  const lookup = body.slice(
    body.indexOf("function registryIcon("),
    body.indexOf("\n  }\n", body.indexOf("function registryIcon(")),
  );
  assert.match(lookup, /entry\.symbol\?\.toLowerCase\(\) === wanted/);

  const tokens = readFileSync("src/bridge/tokens.ts", "utf8");
  const symbols = [
    ...tokens.matchAll(
      /\n  [A-Z0-9]+: \{\n(?:.*\n){0,3}?\s*symbol: "([^"]+)"/g,
    ),
  ].map((m) => m[1].toLowerCase());
  assert.ok(symbols.length >= 8, "the registry has its assets");
  assert.equal(
    new Set(symbols).size,
    symbols.length,
    "and no two share a ticker, so the fallback cannot answer wrongly",
  );
});

test("the transfer runs the plan it signed, not whatever the search now offers", () => {
  // The plan that gets signed and the plan the later legs read were the same only by
  // accident, because every leg read `best` — a *derived* value, recomputed whenever the
  // search publishes. A search landing mid-transfer could substitute a different rail.
  //
  // The symptom was a destination swap that quietly stopped existing: `afterBridge`
  // asked the new plan whether it had a target swap, was told no, finished the transfer
  // without ever doing it, and the receipt opened on time the user had not spent a
  // minute on.
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  // Captured at submit, before anything can replace the derived value.
  assert.match(body, /runningPlan = best;/);
  // The step that decides whether a destination swap happens reads the captured plan.
  const afterBridge = body.slice(
    body.indexOf("async function afterBridge("),
    body.indexOf("\n  }\n", body.indexOf("async function afterBridge(")),
  );
  assert.match(
    afterBridge,
    /if \(runningPlan!\.targetSwap\)/,
    "and not the one currently on screen",
  );
  assert.doesNotMatch(afterBridge, /if \(best!\.targetSwap\)/);
  // No leg of the transfer may read the derived value.
  for (const at of [
    body.match(/plan: best!/g),
    body.match(/best!\.targetSwap/g),
  ]) {
    assert.equal(at, null, "nothing in the transfer path reads `best`");
  }
  // And the receipt and the progress list describe the transfer that ran.
  assert.match(body, /const plan = runningPlan \?\? best;/);
  assert.match(body, /planSteps\(runningPlan \?\? best!/);
  // Sticky for the whole transfer — a NEAR source's second press must find it — and
  // dropped by a reset, so a fresh form is not still rendering a finished transfer.
  assert.match(body, /runningPlan = null;/);
});

test("a parked press is dispatched before the gate can veto it", () => {
  // The regression, and it was mine: a `canSubmit` check placed *above* the parked
  // presses made the button silently inert. The gate counts `searching` and the plan
  // list, and either can go false while a transfer is parked — a balance landing, a
  // search superseded — at which point pressing the button did nothing and the
  // destination swap simply never ran. There is no log of that anywhere.
  //
  // Before this was a ternary, the parked presses were dispatched first and the gate
  // could not reach them. The gate's own comment says why: "A pending final leg is the
  // one thing that must stay pressable."
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  const start = body.indexOf(
    "on:click={() => {",
    body.indexOf("gate.canSubmit\n"),
  );
  const handler = body.slice(start, body.indexOf("}}", start));
  const deposit = handler.indexOf("runDepositPress()");
  const final = handler.indexOf("runFinalSwap()");
  const gate = handler.indexOf("!gate.canSubmit");
  assert.ok(deposit > 0 && final > 0 && gate > 0, "all three are present");
  assert.ok(deposit < gate, "the parked deposit press comes first");
  assert.ok(final < gate, "and so does the final swap");
  // And a refusal is visible rather than silent: the gate is the last thing consulted,
  // so anything it vetoes can be reasoned about from the conditions it names.
  const refusal = body.slice(
    body.indexOf("if (!gate.canSubmit)", body.indexOf("runFinalSwap")),
    body.indexOf(
      "}",
      body.indexOf("if (!gate.canSubmit)", body.indexOf("runFinalSwap")),
    ),
  );
  assert.ok(refusal.length > 0, "the refusal is a reachable branch");
});

test("the spinner is owned by the newest search, not by a generation counter", () => {
  // `generation` is also bumped by `reset()`, which starts no search. A search in flight
  // when that happened was never "current" on the way out, skipped its cleanup, and
  // left `searching` true for the rest of the session: a spinner that never stops, and a
  // button the gate refuses.
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  assert.match(body, /let lastSearchStarted = 0;/);
  assert.match(body, /lastSearchStarted = mine;/);
  assert.match(
    body,
    /if \(mine === lastSearchStarted\) searching = false;/,
    "and the newest search that started is what clears the spinner",
  );
});

test("whether the button can be pressed is decided in one place, not two", () => {
  // The rule was written twice: once as the `disabled` attribute and once in the click
  // handler. The handler was fixed to dispatch a parked press before consulting the
  // gate; the attribute kept consulting the gate first. A disabled button fires no
  // click at all, so the handler never ran — no error, no log, no movement on screen,
  // and the destination swap silently never happened.
  //
  // One derived value feeds both. The failure mode this guards against is invisible:
  // `svelte-check` is happy with two disagreeing expressions, and so is every test that
  // only inspects the handler.
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  assert.match(
    body,
    /\$: canPress = transferDone \|\| parkedPress \|\| gate\.canSubmit;/,
    "one rule, and a parked leg is always pressable",
  );
  assert.match(body, /disabled=\{!canPress\}/, "the attribute uses it");
  assert.doesNotMatch(
    body,
    /disabled=\{!gate\.canSubmit/,
    "and no longer consults the gate on its own",
  );
  // The handler keeps the same ordering, so the two cannot drift the other way either.
  const start = body.indexOf(
    "on:click={() => {",
    body.indexOf("disabled={!canPress}"),
  );
  const handler = body.slice(start, body.indexOf("}}", start));
  assert.ok(
    handler.indexOf("runFinalSwap()") < handler.indexOf("!gate.canSubmit"),
    "a parked press is dispatched before the gate is asked",
  );
});

test("the caller does not finish a transfer that parked", () => {
  // `finishSourceAndTail` finishes the transfer itself when it finishes it, and *parks*
  // when a leg is waiting for a press. The caller called `next()` unconditionally after
  // it, so in the parked case the last step ticked, the transfer was marked done and the
  // receipt opened — for a conversion whose destination swap had not run. No error, no
  // warning: from the code's point of view nothing had gone wrong.
  //
  // The NEAR-source branch returns before reaching that line, which is why the same
  // mistake was invisible there and only showed on Solana sources.
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  const line = body.indexOf("await finishSourceAndTail();");
  const after = body.slice(line, body.indexOf("} catch (err)", line));
  assert.doesNotMatch(
    after,
    /next\(\)/,
    "the caller leaves finishing to the function that did the work",
  );

  // And the invariant that makes it safe: a transfer cannot be finished while a press
  // is pending, so no future caller can re-introduce this.
  const start = body.indexOf("function next() {");
  const fn = body.slice(start, body.indexOf("\n  }\n", start));
  assert.match(fn, /transferState === "awaiting-deposit"/);
  assert.match(fn, /transferState === "awaiting-final"/);
  assert.ok(
    fn.indexOf('transferState === "awaiting-final"') <
      fn.indexOf("showReceipt()"),
    "and the guard comes before the receipt",
  );
  assert.match(
    fn,
    /showReceipt\(\)/,
    "which is still how a finished transfer ends",
  );
});

test("the desktop layout is a grid, not a second copy of the form", () => {
  // The form was a single tall column, which is right on a phone and left most of a
  // desktop window empty. It is two independent ends of a transfer, and side by side is
  // how they are actually thought about.
  //
  // A CSS grid rather than two markups swapped by a JS width check: this form holds two
  // token lists and two wallet addresses, and rendering both layouts would put every
  // id, list and input into the DOM twice.
  const body = readFileSync("src/bridge/AnyToAnyPanel.svelte", "utf8");
  assert.match(
    body,
    /class="grid gap-4 lg:grid-cols-2 items-start"/,
    "one grid, stacked below the breakpoint",
  );
  assert.doesNotMatch(
    body,
    /\{#if desktop\}/,
    "and no second copy of the form behind a width check",
  );
  // Each end is a column of its own, so the amount stays with the token it is about.
  assert.match(
    body,
    /<div class="space-y-4">\s*\n\s*<div class="rounded-xl bg-white\/5 border border-shitzu-4\/45 p-3">\s*\n\s*<ChainEnd\s*\n\s*bare\s*\n\s*label="From"/,
  );
});

test("only the bridge takes the wide container", () => {
  // The 28rem cap is right for a feed or a form that reads better narrow; a wide column
  // of text is worse, not better. The bridge asks for the room explicitly rather than
  // the cap being lifted everywhere.
  const body = readFileSync("src/layout/Body.svelte", "utf8");
  assert.match(body, /export let wide = false;/);
  assert.match(body, /max-w-\[min\(64rem,100%\)\]/, "wide is 64rem");
  assert.match(body, /max-w-\[min\(28rem,100%\)\]/, "the default is unchanged");

  const layout = repo("apps/shitzu-app/src/routes/+layout.svelte");
  assert.match(
    layout,
    /<Body wide=\{\$page\.url\.pathname\.startsWith\("\/bridge"\)\}>/,
    "and the bridge is the one that asks",
  );
});
