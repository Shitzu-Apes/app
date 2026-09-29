<script lang="ts">
  import { PublicKey } from "@solana/web3.js";
  import { onDestroy } from "svelte";
  import { slide } from "svelte/transition";

  import {
    requireNearWallet,
    requireSolanaWallet,
  } from "$lib/auth/showWalletSelector";
  import TransferStatus from "$lib/bridge/TransferStatus.svelte";
  import {
    bridgeGate,
    formatBaseUnits,
    formatBaseUnitsExact,
    parseBaseUnits,
  } from "$lib/bridge/amount";
  import { CHAINS } from "$lib/bridge/chains";
  import { OMNI_NETWORK } from "$lib/bridge/omni";
  import {
    bridgeSolanaToNear,
    getWnearBridgeFee,
    quoteToWnear,
    reconcileTransfer,
    type BridgeFeeQuote,
    type BridgeProgress,
  } from "$lib/bridge/solanaToNear";
  import { getTransferKey, type BridgePhase } from "$lib/bridge/status";
  import { transfers } from "$lib/bridge/transfers";
  import { addToast } from "$lib/components/Toast.svelte";
  import SummaryRow from "$lib/components/memecooking/BottomSheet/SummaryRow.svelte";
  import { BottomSheetContent } from "$lib/layout/BottomSheet";
  import { closeBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import { nearWallet } from "$lib/near";
  import { describeRoute, SWAP_TOKENS, WNEAR_MINT } from "$lib/solana/jupiter";
  import {
    fetchWalletTokens,
    formatTokenBalance,
    WSOL_MINT,
    type WalletToken,
  } from "$lib/solana/tokenBalances";
  import { solanaWallet } from "$lib/solana/wallet";

  const { accountId$ } = nearWallet;
  const { publicKey$ } = solanaWallet;

  const NEAR_ICON = CHAINS.near.icon;
  const SOL_ICON = CHAINS.solana.icon;

  /**
   * The wNEAR Omni Bridge route only settles on mainnet. Jupiter quotes mainnet
   * pools, and testnet's bridge contract has no wNEAR token registered, so a
   * testnet deposit can never complete. Fail loudly up front instead of
   * letting the user sign two transactions that go nowhere.
   */
  const IS_SUPPORTED = OMNI_NETWORK === "mainnet";

  /** What the user is told while the deposit makes its way to NEAR. */
  const PHASE_COPY: Record<BridgePhase, string> = {
    submitted: "Submitted to Solana. Waiting for the network to accept it…",
    confirmed: "Confirmed on Solana. Waiting for the bridge to pick it up…",
    finalising: "Locked by the bridge. Finalising on Near…",
    finalised: "Finalised on Near.",
  };

  const PHASES: BridgePhase[] = [
    "submitted",
    "confirmed",
    "finalising",
    "finalised",
  ];

  const PHASE_LABELS: Record<BridgePhase, string> = {
    submitted: "Sent on Solana",
    confirmed: "Confirmed on Solana",
    finalising: "Finalising on Near",
    // There is no claim step when bridging *to* Near: the tokens are credited
    // to the recipient directly once finalised.
    finalised: "Received on Near",
  };

  const phaseIndex = (p: BridgePhase) => PHASES.indexOf(p);

  let sourceMint: string = WSOL_MINT;
  let amountInput: string | undefined = undefined;

  let quote: Awaited<ReturnType<typeof quoteToWnear>> = null;
  let isQuoting = false;
  let noRoute = false;
  let isBridging = false;
  let progress: BridgeProgress | null = null;
  let phase_: BridgePhase = "submitted";
  let poll: { attempt: number; total: number } | null = null;
  let error: string | null = null;

  /** Live bridge fee quote, so the cost is known before anything is signed. */
  let feeQuote: BridgeFeeQuote | null = null;
  let isQuotingFee = false;
  /** Set once a transfer has landed, so the form can be reset. */
  let done = false;
  let result: { bridged: bigint; tokenFee: bigint } | null = null;

  /**
   * Every token the connected wallet holds, discovered from the chain rather
   * than hardcoded, so the user can bridge from whatever they actually have.
   */
  let walletTokens: WalletToken[] = [];
  let tokensOwner: string | null = null;
  let isLoadingTokens = false;

  const NEAR_SYMBOL = SWAP_TOKENS.WNEAR.symbol;
  const WNEAR_DECIMALS = SWAP_TOKENS.WNEAR.decimals;

  /** Used before balances load, and if the wallet holds nothing. */
  const FALLBACK_SOURCE: WalletToken = {
    mint: WSOL_MINT,
    balance: 0n,
    decimals: 9,
    symbol: "SOL",
    routable: true,
    native: true,
  };

  /** Quick-fill options. 100% is the same as Max. */
  const PERCENTS = [25, 50, 75, 100];

  function formatUsd(value: number): string {
    if (value >= 1000) {
      return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    }
    if (value >= 1) return `$${value.toFixed(2)}`;
    if (value >= 0.01) return `$${value.toFixed(3)}`;
    return `$${value.toPrecision(2)}`;
  }

  /** Clear everything back to a pristine form. */
  function reset() {
    amountInput = undefined;
    quote = null;
    noRoute = false;
    isQuoting = false;
    feeQuote = null;
    isQuotingFee = false;
    isBridging = false;
    progress = null;
    phase_ = "submitted";
    poll = null;
    error = null;
    done = false;
    result = null;
    // The token list is a property of the wallet, not of one transfer, so it
    // deliberately survives a reset.
  }

  onDestroy(reset);

  $: source =
    walletTokens.find((t) => t.mint === sourceMint) ?? FALLBACK_SOURCE;
  $: needsSwap = source.mint !== WNEAR_MINT;
  $: currentBalance = source.balance;
  $: solBalanceNow =
    walletTokens.find((t) => t.mint === WSOL_MINT)?.balance ?? null;

  $: amount = parseBaseUnits(amountInput, source.decimals);

  $: if ($publicKey$) void loadWalletTokens($publicKey$);

  /**
   * Read every token the wallet holds rather than a fixed list, so the picker
   * reflects what the user actually has. Balances and decimals come from the
   * chain; symbols and icons from Jupiter's token list.
   */
  async function loadWalletTokens(owner: PublicKey) {
    const requested = owner.toBase58();
    if (tokensOwner === requested && walletTokens.length > 0) return;
    tokensOwner = requested;
    isLoadingTokens = true;
    try {
      const found = await fetchWalletTokens(
        solanaWallet.getConnection(),
        owner,
      );
      if (tokensOwner !== requested) return; // wallet changed mid-flight
      walletTokens = found;
      // Keep the current selection if it is still held, else fall back.
      if (!found.some((t) => t.mint === sourceMint)) {
        const first = found.find((t) => t.routable) ?? found[0];
        if (first) selectToken(first.mint);
      }
    } catch {
      walletTokens = [];
    } finally {
      isLoadingTokens = false;
    }
  }

  // Debounced quote. Keyed on the amount so typing does not spam Jupiter.
  let quoteTimer: ReturnType<typeof setTimeout> | undefined;
  $: quoteInputs = `${amount ?? ""}:${source.mint}:${IS_SUPPORTED}`;
  $: {
    quoteInputs;
    clearTimeout(quoteTimer);
    if (IS_SUPPORTED && needsSwap && amount !== null && amount > 0n) {
      isQuoting = true;
      noRoute = false;
      quoteTimer = setTimeout(() => void runQuote(amount!, source.mint), 400);
    } else {
      quote = null;
      noRoute = false;
      isQuoting = false;
    }
  }

  async function runQuote(value: bigint, inputMint: string) {
    try {
      const result = await quoteToWnear(value, inputMint, 100);
      // Ignore a response that arrived after the inputs changed again.
      if (value !== amount || inputMint !== source.mint) return;
      quote = result;
      noRoute = result === null;
    } catch {
      quote = null;
      error = "Could not fetch a quote. Try again.";
    } finally {
      isQuoting = false;
    }
  }

  /** wNEAR that will be deposited, before the bridge's own token fee. */
  $: bridgedWnear = needsSwap
    ? quote
      ? BigInt(quote.otherAmountThreshold)
      : null
    : amount;

  // Quote the bridge fee for the amount we would actually deposit, so the cost
  // is on screen before anything is signed.
  let feeTimer: ReturnType<typeof setTimeout> | undefined;
  $: feeInputs = `${bridgedWnear ?? ""}:${$accountId$ ?? ""}:${$publicKey$?.toBase58() ?? ""}:${IS_SUPPORTED}`;
  $: {
    feeInputs;
    clearTimeout(feeTimer);
    const target = bridgedWnear;
    if (
      IS_SUPPORTED &&
      target !== null &&
      target > 0n &&
      $accountId$ &&
      $publicKey$ &&
      !done
    ) {
      isQuotingFee = true;
      const want = target;
      const to = $accountId$;
      const from = $publicKey$;
      feeTimer = setTimeout(() => void runFeeQuote(want, from, to), 400);
    } else {
      feeQuote = null;
      isQuotingFee = false;
    }
  }

  async function runFeeQuote(amountWnear: bigint, from: PublicKey, to: string) {
    try {
      const quote = await getWnearBridgeFee(from, to, amountWnear);
      // Discard a response that arrived after the inputs changed again.
      if (amountWnear !== bridgedWnear) return;
      feeQuote = quote;
    } catch {
      feeQuote = null;
    } finally {
      isQuotingFee = false;
    }
  }

  /**
   * SOL that must stay put to pay for the deposit, plus a buffer for the
   * transaction fees themselves. Paid in SOL regardless of which token is being
   * bridged, so this is checked separately from the source balance.
   */
  const TX_FEE_BUFFER = 20_000n; // 0.00002 SOL
  $: solReserve = (feeQuote?.nativeFee ?? 100_000n) + TX_FEE_BUFFER;

  /**
   * What can actually be spent. When paying in SOL the reserve has to come out
   * of the same balance, so the usable amount is reduced by it.
   */
  $: available =
    currentBalance === null
      ? null
      : source.mint === WSOL_MINT
        ? currentBalance > solReserve
          ? currentBalance - solReserve
          : 0n
        : currentBalance;

  $: gate = bridgeGate({
    amount,
    bridgedWnear,
    needsSwap,
    quoteAvailable: needsSwap ? (isQuoting ? null : !noRoute && !!quote) : true,
    nearConnected: Boolean($accountId$),
    solanaConnected: Boolean($publicKey$),
    isBridging,
    supported: IS_SUPPORTED,
    tokenFee: feeQuote?.tokenFee ?? null,
    done,
    available,
    solBalance: solBalanceNow,
    solReserve,
  });

  $: tooSmall = gate.tooSmall;
  $: canSubmit = gate.canSubmit;
  $: netAmount = gate.netAmount;
  $: buttonLabel = isBridging ? (progress?.message ?? "Bridging…") : gate.label;

  $: myTransfers = $transfers.filter((t) => t.id?.origin_chain === "Sol");

  function setPercent(percent: number) {
    // Percentages are taken from the spendable balance rather than the raw
    // one, which is what makes 100% mean "everything you can actually send":
    // for native SOL the network fee is already reserved, so no percentage can
    // land on an amount the gate rejects.
    //
    // The result is written exactly, not through the rounded display formatter.
    // That formatter rounds to six fraction digits, so on a 0.006051912 NEAR
    // holding 100% produced 6052000 against a balance of 6051912 and the gate
    // rejected the amount the button had just set.
    amountInput = formatBaseUnitsExact(
      ((available ?? 0n) * BigInt(percent)) / 100n,
      source.decimals,
    );
  }

  function selectToken(mint: string) {
    sourceMint = mint;
    amountInput = undefined;
    quote = null;
    error = null;
  }

  function onSubmit() {
    if (!IS_SUPPORTED) return;
    if (!$accountId$) {
      requireNearWallet("shitzu");
      return;
    }
    if (!$publicKey$) {
      requireSolanaWallet("shitzu");
      return;
    }
    if (!canSubmit || amount === null) return;

    const provider = solanaWallet.getProvider();
    if (!provider) {
      // Should be unreachable: publicKey$ and the provider are now set together.
      error =
        "Your Solana wallet is not ready to sign. Disconnect and reconnect it, then try again.";
      return;
    }

    error = null;
    isBridging = true;
    progress = null;
    poll = null;

    void (async () => {
      try {
        const { signature, bridged, tokenFee } = await bridgeSolanaToNear({
          amount,
          sourceMint: source.mint,
          recipient: $accountId$!,
          provider,
          onProgress: (p) => {
            progress = p;
            poll = null;
          },
        });

        await reconcileTransfer(signature, (phase, attempt, total) => {
          phase_ = phase;
          poll = { attempt, total };
          progress = { leg: "bridge", message: PHASE_COPY[phase] };
        });

        // Land in an explicit terminal state instead of yanking the sheet
        // closed, so the amounts are readable and the form is not left
        // half-finished with a progress message on the button.
        result = { bridged, tokenFee };
        done = true;
        isBridging = false;
        progress = null;
        poll = null;

        addToast({
          data: {
            type: "simple",
            data: {
              title: "Bridge complete",
              description: "Your NEAR has arrived on Near.",
              type: "success",
            },
          },
        });

        if ($publicKey$) await loadWalletTokens($publicKey$);
      } catch (err) {
        error =
          err instanceof Error ? err.message : "The bridge failed. Try again.";
      } finally {
        isBridging = false;
        progress = null;
        poll = null;
      }
    })();
  }

  /** Closing after a completed transfer always starts from a clean form. */
  function finish() {
    reset();
    closeBottomSheet();
  }
</script>

<BottomSheetContent variant="shitzu">
  <svelte:fragment slot="header">
    <div class="flex items-center gap-2 px-4 py-2">
      <img src={SOL_ICON} alt="Solana" class="w-6 h-6 rounded-full" />
      <span class="text-shitzu-4">&rarr;</span>
      <img src={NEAR_ICON} alt="Near" class="w-6 h-6 rounded-full" />
      <h2 class="text-xl font-bold text-shitzu-1">Bridge to Near</h2>
    </div>
  </svelte:fragment>

  <!--
    Every text colour here is explicit. The sheet inherits `body`'s default
    black text, which is ~1.1:1 against the #222 panel, so anything without a
    colour class is invisible. Contrast ratios are checked in
    scripts/contrast.mjs.
  -->
  <section class="px-4 pt-4 pb-6 space-y-4 text-shitzu-1">
    {#if !IS_SUPPORTED}
      <div
        class="rounded-xl bg-white/5 border border-amber-300/45 p-4 text-sm text-amber-200"
      >
        <div class="font-semibold mb-1">Not available on testnet</div>
        <div class="text-shitzu-2">
          Bridging to Near only works on mainnet, because that is the only
          network the Omni Bridge lists this token on. Use the mainnet app to
          bridge.
        </div>
      </div>
    {/if}

    <!--
      The form is hidden once a transfer has landed, so a stale amount, quote
      or fee cannot be mistaken for a fresh one.

      It deliberately stays visible *while* the transfer runs. It used to be
      hidden on `isBridging` too, which meant that clicking the button blanked
      the whole modal before the wallet had even asked for a signature, losing
      the from/to context at exactly the moment the user needed it. Instead it
      stays put and goes inert: the inputs and token buttons are already
      disabled, and the values double as a record of what was submitted.
      `space-y-4` has to live here as well: this div is what separates the cards.
    -->
    <div
      class="space-y-4 transition-opacity duration-200"
      class:hidden={done}
      class:opacity-50={isBridging && !done}
      class:pointer-events-none={isBridging && !done}
      aria-busy={isBridging && !done}
    >
      <div class="rounded-xl bg-white/5 border border-shitzu-4/45 p-3">
        <div
          class="text-xs font-semibold uppercase tracking-wide text-shitzu-3"
        >
          From
        </div>
        {#if $publicKey$}
          <div class="flex items-center gap-2 mt-1.5">
            <img src={SOL_ICON} alt="Solana" class="w-5 h-5 rounded-full" />
            <span class="font-mono text-sm break-all">
              {$publicKey$.toBase58()}
            </span>
          </div>
        {:else}
          <button
            class="mt-2 w-full px-4 py-2 rounded-lg text-sm bg-shitzu-4 text-black font-semibold hover:bg-shitzu-5 transition-colors"
            on:click={() => requireSolanaWallet("shitzu")}
          >
            Connect Solana wallet
          </button>
        {/if}
      </div>

      <div class="rounded-xl bg-white/5 border border-shitzu-4/45 p-3">
        <div
          class="text-xs font-semibold uppercase tracking-wide text-shitzu-3"
        >
          To
        </div>
        {#if $accountId$}
          <div class="flex items-center gap-2 mt-1.5">
            <img src={NEAR_ICON} alt="Near" class="w-5 h-5 rounded-full" />
            <span class="font-mono text-sm break-all">{$accountId$}</span>
          </div>
        {:else}
          <button
            class="mt-2 w-full px-4 py-2 rounded-lg text-sm bg-shitzu-4 text-black font-semibold hover:bg-shitzu-5 transition-colors"
            on:click={() => requireNearWallet("shitzu")}
          >
            Connect NEAR wallet
          </button>
        {/if}
      </div>

      <div>
        <div class="flex items-center justify-between mb-2">
          <span
            class="text-xs font-semibold uppercase tracking-wide text-shitzu-3"
          >
            Pay with
          </span>
          {#if isLoadingTokens}
            <div class="i-mdi:loading animate-spin text-shitzu-3 text-sm" />
          {:else}
            <span class="text-xs text-shitzu-2">
              {walletTokens.length}
              {walletTokens.length === 1 ? "token" : "tokens"}
            </span>
          {/if}
        </div>

        {#if walletTokens.length === 0 && !isLoadingTokens}
          <div
            class="rounded-xl bg-white/5 border border-shitzu-4/45 p-3 text-sm text-shitzu-2"
          >
            No tokens found in this wallet.
          </div>
        {:else}
          <ul
            class="max-h-56 overflow-y-auto overscroll-contain noscrollbar rounded-xl border border-shitzu-4/45 divide-y divide-shitzu-4/20"
          >
            {#each walletTokens as token (token.mint)}
              <li>
                <button
                  class="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors {sourceMint ===
                  token.mint
                    ? 'bg-shitzu-4/15'
                    : 'hover:bg-white/5'}"
                  disabled={isBridging}
                  on:click={() => selectToken(token.mint)}
                >
                  {#if token.icon}
                    <img
                      src={token.icon}
                      alt=""
                      class="w-7 h-7 rounded-full shrink-0"
                      loading="lazy"
                    />
                  {:else}
                    <span
                      class="w-7 h-7 rounded-full bg-shitzu-4/20 shrink-0"
                    />
                  {/if}

                  <span class="flex-1 min-w-0">
                    <span class="flex items-center gap-1.5">
                      <span class="text-sm font-semibold truncate">
                        {token.symbol}
                      </span>
                      {#if !token.routable}
                        <span
                          class="text-[10px] px-1 py-0.5 rounded bg-shitzu-4/20 text-shitzu-2 shrink-0"
                        >
                          no route
                        </span>
                      {/if}
                    </span>
                    <span class="block text-xs text-shitzu-2">
                      {formatTokenBalance(token)}
                    </span>
                  </span>

                  <span class="text-xs text-shitzu-2 shrink-0 text-right">
                    {#if token.usdValue !== undefined && token.usdValue > 0}
                      {formatUsd(token.usdValue)}
                    {/if}
                  </span>

                  <div
                    class="w-4 h-4 rounded-full border-2 shrink-0 {sourceMint ===
                    token.mint
                      ? 'border-shitzu-4 bg-shitzu-4'
                      : 'border-shitzu-4/45'}"
                  />
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <div class="rounded-xl bg-white/5 border border-shitzu-4/45 p-3">
        <div class="flex items-center justify-between gap-3">
          <span class="text-sm font-medium">Amount</span>
          <span class="text-xs text-shitzu-2 text-right">
            {#if currentBalance === null}
              Balance &mdash;
            {:else}
              Balance {formatBaseUnits(currentBalance, source.decimals)}
              {source.symbol}
            {/if}
          </span>
        </div>
        <div class="flex items-center gap-2 mt-2">
          <input
            class="flex-1 bg-transparent outline-none text-3xl font-semibold w-full min-w-0 text-shitzu-1 placeholder:text-shitzu-500"
            type="text"
            inputmode="decimal"
            placeholder="0.0"
            bind:value={amountInput}
            disabled={isBridging}
          />
          <span class="text-base font-medium text-shitzu-2 shrink-0"
            >{source.symbol}</span
          >
        </div>
        <div class="grid grid-cols-4 gap-1.5 mt-3">
          {#each PERCENTS as pct}
            <button
              class="px-2 py-1.5 rounded-lg text-xs font-semibold bg-white/5 text-shitzu-1 border border-shitzu-4/45 hover:bg-white/10 transition-colors disabled:text-shitzu-600 disabled:hover:bg-white/5"
              disabled={isBridging || !available || available <= 0n}
              on:click={() => setPercent(pct)}
            >
              {pct}%
            </button>
          {/each}
        </div>
      </div>

      <!--
        One summary card: route, what the swap yields, what the bridge takes,
        and what actually lands. The bridge deducts its fee from the deposited
        amount, so slightly less than the swap output arrives, and that
        difference used to be invisible.
      -->
      <div
        class="rounded-xl bg-white/5 border border-shitzu-4/45 p-3 space-y-1.5"
      >
        {#if needsSwap}
          <SummaryRow
            label="Route"
            value={noRoute
              ? "No route available"
              : quote
                ? describeRoute(quote)
                : null}
            tone={noRoute ? "warning" : "default"}
            pending={!noRoute && !quote}
          />
        {/if}

        <SummaryRow
          label={needsSwap ? "Swap output" : "Amount"}
          value={bridgedWnear !== null && bridgedWnear > 0n
            ? `${formatBaseUnits(bridgedWnear, WNEAR_DECIMALS)} ${NEAR_SYMBOL}`
            : null}
        />

        <!-- One row for the whole cost: the NEAR the bridge takes plus the SOL
             spent on the network. -->
        <SummaryRow
          label="Bridge fee"
          value={feeQuote
            ? `\u2212${formatBaseUnits(feeQuote.tokenFee, WNEAR_DECIMALS)} ${NEAR_SYMBOL} / ${formatBaseUnits(feeQuote.nativeFee, 9)} SOL`
            : null}
          tone="warning"
          pending={isQuotingFee}
        />

        <SummaryRow
          label="You receive on Near"
          value={netAmount !== null
            ? `${formatBaseUnits(netAmount, WNEAR_DECIMALS)} ${NEAR_SYMBOL}`
            : null}
          tone="strong"
          pending={isQuotingFee}
        />
      </div>

      {#if gate.insufficientBalance && amount !== null && amount > 0n}
        <div class="text-sm text-red-300">
          More than the {formatBaseUnits(available ?? 0n, source.decimals)}
          {source.symbol} available.
        </div>
      {/if}

      {#if gate.insufficientSol}
        <div class="text-sm text-red-300">
          Not enough SOL to pay the network fee.
        </div>
      {/if}

      {#if tooSmall && amount !== null && amount > 0n}
        <div class="text-sm text-amber-300">
          That amount is too small to cover the bridge fee.
        </div>
      {/if}

      {#if error}
        <div class="text-sm text-red-300">{error}</div>
      {/if}
    </div>

    {#if poll}
      <div
        class="rounded-xl bg-white/5 border border-shitzu-4/45 p-3 space-y-2"
        in:slide
      >
        <div class="flex items-center gap-2 text-sm text-shitzu-1">
          <div class="i-mdi:loading animate-spin text-shitzu-3" />
          <span>{PHASE_COPY[phase_]}</span>
        </div>
        <ol class="space-y-1 text-xs">
          {#each PHASES as p}
            <li class="flex items-center gap-2">
              <div
                class="w-1.5 h-1.5 rounded-full {phaseIndex(p) <
                phaseIndex(phase_)
                  ? 'bg-shitzu-4'
                  : phaseIndex(p) === phaseIndex(phase_)
                    ? 'bg-shitzu-3 animate-pulse'
                    : 'bg-shitzu-4/30'}"
              />
              <span
                class={phaseIndex(p) <= phaseIndex(phase_)
                  ? "text-shitzu-2"
                  : "text-shitzu-3/60"}
              >
                {PHASE_LABELS[p]}
              </span>
            </li>
          {/each}
        </ol>
      </div>
    {/if}

    {#if done}
      <div
        class="rounded-xl bg-shitzu-4/10 border border-shitzu-4/45 p-4 space-y-2"
        in:slide
      >
        <div class="flex items-center gap-2 text-shitzu-1 font-semibold">
          <div class="i-mdi:check-circle text-shitzu-4 text-xl" />
          Arrived on Near
        </div>
        {#if result}
          <div class="flex justify-between gap-3 text-sm">
            <span class="text-shitzu-2 shrink-0">Received</span>
            <span class="text-right font-semibold">
              {formatBaseUnits(result.bridged, WNEAR_DECIMALS)}
              {NEAR_SYMBOL}
            </span>
          </div>
          <div class="flex justify-between gap-3 text-sm">
            <span class="text-shitzu-2 shrink-0">Bridge fee</span>
            <span class="text-right text-shitzu-2">
              −{formatBaseUnits(result.tokenFee, WNEAR_DECIMALS)}
              {NEAR_SYMBOL}
            </span>
          </div>
        {/if}
        <div class="text-xs text-shitzu-2">
          Credited to {$accountId$}. There is nothing to claim.
        </div>
      </div>
    {/if}

    <button
      class="w-full px-4 py-3 rounded-lg font-semibold transition-colors {canSubmit
        ? 'bg-shitzu-4 text-black hover:bg-shitzu-5'
        : done
          ? 'bg-shitzu-4 text-black hover:bg-shitzu-5'
          : 'bg-white/10 text-shitzu-3 border border-shitzu-4/45'}"
      on:click={done ? finish : onSubmit}
    >
      {done ? "Done" : buttonLabel}
    </button>

    {#if myTransfers.length > 0}
      <div class="pt-3 border-t border-shitzu-4/45">
        <div class="text-sm font-semibold text-shitzu-1 mb-2">
          Recent transfers
        </div>
        <div class="space-y-1.5">
          {#each myTransfers as transfer (getTransferKey(transfer))}
            <div in:slide|global>
              <TransferStatus {transfer} />
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </section>
</BottomSheetContent>
