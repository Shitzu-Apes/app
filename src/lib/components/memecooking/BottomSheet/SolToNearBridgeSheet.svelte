<script lang="ts">
  import { getAccount, getAssociatedTokenAddress } from "@solana/spl-token";
  import { PublicKey } from "@solana/web3.js";
  import { slide } from "svelte/transition";

  import {
    requireNearWallet,
    requireSolanaWallet,
  } from "$lib/auth/showWalletSelector";
  import TransferStatus from "$lib/bridge/TransferStatus.svelte";
  import {
    bridgeGate,
    formatBaseUnits,
    parseBaseUnits,
  } from "$lib/bridge/amount";
  import { CHAINS } from "$lib/bridge/chains";
  import { OMNI_NETWORK } from "$lib/bridge/omni";
  import {
    bridgeSolanaToNear,
    quoteToWnear,
    reconcileTransfer,
    type BridgeProgress,
  } from "$lib/bridge/solanaToNear";
  import { transfers } from "$lib/bridge/transfers";
  import { addToast } from "$lib/components/Toast.svelte";
  import { BottomSheetContent } from "$lib/layout/BottomSheet";
  import { closeBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import { nearWallet } from "$lib/near";
  import { getSolBalance } from "$lib/solana/balance";
  import { describeRoute, SWAP_TOKENS } from "$lib/solana/jupiter";
  import { solanaWallet } from "$lib/solana/wallet";

  const { accountId$ } = nearWallet;
  const { publicKey$ } = solanaWallet;

  const SOURCE_KEYS = ["SOL", "WNEAR", "USDC"] as const;
  type SourceKey = (typeof SOURCE_KEYS)[number];

  const NEAR_ICON = CHAINS.near.icon;
  const SOL_ICON = CHAINS.solana.icon;
  const WNEAR_DECIMALS = SWAP_TOKENS.WNEAR.decimals;

  /**
   * The wNEAR Omni Bridge route only settles on mainnet. Jupiter quotes mainnet
   * pools, and testnet's bridge contract has no wNEAR token registered, so a
   * testnet deposit can never complete. Fail loudly up front instead of
   * letting the user sign two transactions that go nowhere.
   */
  const IS_SUPPORTED = OMNI_NETWORK === "mainnet";

  let sourceKey: SourceKey = "SOL";
  let amountInput: string | undefined = undefined;

  let quote: Awaited<ReturnType<typeof quoteToWnear>> = null;
  let isQuoting = false;
  let noRoute = false;
  let isBridging = false;
  let progress: BridgeProgress | null = null;
  let poll: { attempt: number; total: number } | null = null;
  let error: string | null = null;

  let balances: Record<string, bigint> = {};

  $: source = SWAP_TOKENS[sourceKey];
  $: needsSwap = source.mint !== SWAP_TOKENS.WNEAR.mint;
  $: currentBalance = balances[sourceKey] ?? null;

  $: amount = parseBaseUnits(amountInput, source.decimals);

  $: if ($publicKey$) void refreshBalances($publicKey$);

  async function readTokenBalance(
    mint: string,
    owner: PublicKey,
  ): Promise<bigint> {
    try {
      const ata = await getAssociatedTokenAddress(new PublicKey(mint), owner);
      return BigInt(
        (await getAccount(solanaWallet.getConnection(), ata)).amount,
      );
    } catch {
      // A missing ATA just means a zero balance.
      return 0n;
    }
  }

  async function refreshBalances(owner: PublicKey) {
    const connection = solanaWallet.getConnection();
    try {
      const [sol, wnear, usdc] = await Promise.all([
        getSolBalance(connection, owner),
        readTokenBalance(SWAP_TOKENS.WNEAR.mint, owner),
        readTokenBalance(SWAP_TOKENS.USDC.mint, owner),
      ]);
      balances = { SOL: sol, WNEAR: wnear, USDC: usdc };
    } catch {
      // Best effort: the quote and the bridge still work without balances.
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

  $: gate = bridgeGate({
    amount,
    bridgedWnear,
    needsSwap,
    quoteAvailable: needsSwap ? (isQuoting ? null : !noRoute && !!quote) : true,
    nearConnected: Boolean($accountId$),
    solanaConnected: Boolean($publicKey$),
    isBridging,
    supported: IS_SUPPORTED,
  });

  $: tooSmall = gate.tooSmall;
  $: canSubmit = gate.canSubmit;
  $: buttonLabel = isBridging ? (progress?.message ?? "Bridging…") : gate.label;

  $: myTransfers = $transfers.filter((t) => t.id?.origin_chain === "Sol");

  function setMax() {
    amountInput = formatBaseUnits(currentBalance ?? 0n, source.decimals);
  }

  function selectSource(key: SourceKey) {
    sourceKey = key;
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
      error = "Your Solana wallet is not ready. Reconnect and try again.";
      return;
    }

    error = null;
    isBridging = true;
    progress = null;
    poll = null;

    void (async () => {
      try {
        const { signature } = await bridgeSolanaToNear({
          amount,
          sourceMint: source.mint,
          recipient: $accountId$!,
          provider,
          onProgress: (p) => {
            progress = p;
            poll = null;
          },
        });

        progress = { leg: "bridge", message: "Waiting for confirmation…" };
        await reconcileTransfer(signature, (attempt, total) => {
          poll = { attempt, total };
        });

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

        amountInput = undefined;
        quote = null;
        if ($publicKey$) await refreshBalances($publicKey$);
        closeBottomSheet();
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
    <div class="rounded-xl bg-white/5 border border-shitzu-4/45 p-3">
      <div class="text-xs font-semibold uppercase tracking-wide text-shitzu-3">
        From
      </div>
      {#if $publicKey$}
        <div class="flex items-center gap-2 mt-1.5">
          <img src={SOL_ICON} alt="Solana" class="w-5 h-5 rounded-full" />
          <span class="font-mono text-sm break-all">
            {$publicKey$.toBase58()}
          </span>
        </div>
        <div class="text-xs text-shitzu-2 mt-1.5">
          Funds are taken from this Solana wallet.
        </div>
      {:else}
        <button
          class="mt-2 w-full px-4 py-2 rounded-lg text-sm bg-shitzu-4 text-black font-semibold hover:bg-shitzu-5 transition-colors"
          on:click={() => requireSolanaWallet("shitzu")}
        >
          Connect Solana wallet
        </button>
        <div class="text-xs text-shitzu-2 mt-2">
          You need a Solana wallet to pay from.
        </div>
      {/if}
    </div>

    <div class="rounded-xl bg-white/5 border border-shitzu-4/45 p-3">
      <div class="text-xs font-semibold uppercase tracking-wide text-shitzu-3">
        To
      </div>
      {#if $accountId$}
        <div class="flex items-center gap-2 mt-1.5">
          <img src={NEAR_ICON} alt="Near" class="w-5 h-5 rounded-full" />
          <span class="font-mono text-sm break-all">{$accountId$}</span>
        </div>
        <div class="text-xs text-shitzu-2 mt-1.5">
          You receive NEAR on this account.
        </div>
      {:else}
        <button
          class="mt-2 w-full px-4 py-2 rounded-lg text-sm bg-shitzu-4 text-black font-semibold hover:bg-shitzu-5 transition-colors"
          on:click={() => requireNearWallet("shitzu")}
        >
          Connect NEAR wallet
        </button>
        <div class="text-xs text-shitzu-2 mt-2">
          You need a Near wallet to receive the tokens.
        </div>
      {/if}
    </div>

    <div>
      <div
        class="text-xs font-semibold uppercase tracking-wide text-shitzu-3 mb-2"
      >
        Pay with
      </div>
      <div class="grid grid-cols-3 gap-2">
        {#each SOURCE_KEYS as key}
          <button
            class="px-3 py-2 rounded-lg text-sm font-semibold transition-colors border {sourceKey ===
            key
              ? 'bg-shitzu-4 text-black border-shitzu-4'
              : 'bg-white/5 text-shitzu-1 border-shitzu-4/45 hover:bg-white/10'}"
            disabled={isBridging}
            on:click={() => selectSource(key)}
          >
            {SWAP_TOKENS[key].symbol}
          </button>
        {/each}
      </div>
    </div>

    <div class="rounded-xl bg-white/5 border border-shitzu-4/45 p-3">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium">Amount</span>
        <button
          class="text-xs font-semibold text-shitzu-3 hover:text-shitzu-1 hover:underline disabled:text-shitzu-600 disabled:hover:no-underline"
          disabled={isBridging || currentBalance === null}
          on:click={setMax}
        >
          Max
        </button>
      </div>
      <div class="flex items-center gap-2 mt-2">
        <input
          class="flex-1 bg-transparent outline-none text-3xl font-semibold w-full text-shitzu-1 placeholder:text-shitzu-500"
          type="text"
          inputmode="decimal"
          placeholder="0.0"
          bind:value={amountInput}
          disabled={isBridging}
        />
        <span class="text-base font-medium text-shitzu-2">{source.symbol}</span>
      </div>
      <div class="text-xs text-shitzu-2 mt-1.5">
        Balance: {formatBaseUnits(currentBalance, source.decimals)}
        {source.symbol}
      </div>
    </div>

    {#if needsSwap && (isQuoting || noRoute || quote)}
      <div
        class="rounded-xl bg-white/5 border border-shitzu-4/45 p-3 space-y-1.5"
        transition:slide
      >
        {#if isQuoting}
          <div class="text-sm text-shitzu-2">Fetching quote…</div>
        {:else if noRoute}
          <div class="text-sm text-red-300">
            No route to NEAR for that amount. Try a different amount.
          </div>
        {:else if quote}
          <div class="flex justify-between gap-3 text-sm">
            <span class="text-shitzu-2 shrink-0">Route</span>
            <span class="text-right break-words">{describeRoute(quote)}</span>
          </div>
          <div class="flex justify-between gap-3 text-sm">
            <span class="text-shitzu-2 shrink-0">You receive (min)</span>
            <span class="text-right">
              {formatBaseUnits(
                BigInt(quote.otherAmountThreshold),
                WNEAR_DECIMALS,
              )}
              {SWAP_TOKENS.WNEAR.symbol}
            </span>
          </div>
          {#if Number(quote.priceImpactPct) > 0.01}
            <div class="flex justify-between gap-3 text-sm text-amber-300">
              <span>Price impact</span>
              <span>{(Number(quote.priceImpactPct) * 100).toFixed(2)}%</span>
            </div>
          {/if}
        {/if}
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

    {#if poll}
      <div class="text-xs text-shitzu-2">
        Confirming with the bridge indexer ({poll.attempt}/{poll.total})…
      </div>
    {/if}

    <button
      class="w-full px-4 py-3 rounded-lg font-semibold transition-colors {canSubmit
        ? 'bg-shitzu-4 text-black hover:bg-shitzu-5'
        : 'bg-white/10 text-shitzu-3 border border-shitzu-4/45'}"
      on:click={onSubmit}
    >
      {buttonLabel}
    </button>

    <div class="text-xs text-shitzu-2 leading-relaxed">
      {#if needsSwap}
        This swaps {source.symbol} to NEAR on Solana, then bridges it to your Near
        account. You sign two transactions.
      {:else}
        This bridges your NEAR from Solana to your Near account.
      {/if}
    </div>

    {#if myTransfers.length > 0}
      <div class="pt-3 border-t border-shitzu-4/45">
        <div class="text-sm font-semibold text-shitzu-1 mb-2">
          Recent transfers
        </div>
        <div class="space-y-1.5">
          {#each myTransfers as transfer (transfer.id?.origin_chain + ":" + transfer.id?.kind.Nonce)}
            <div in:slide|global>
              <TransferStatus {transfer} />
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </section>
</BottomSheetContent>
