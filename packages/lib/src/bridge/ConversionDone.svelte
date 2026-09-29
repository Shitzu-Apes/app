<script context="module" lang="ts">
  import { formatUsd } from "$lib/bridge/format";
</script>

<script lang="ts">
  import RouteSteps from "$lib/bridge/RouteSteps.svelte";
  import type { RouteStep } from "$lib/bridge/steps";
  import { closeBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";

  /**
   * The receipt for a conversion that finished.
   *
   * Shown because the alternative was the form itself sitting on a completed plan
   * with a button offering to bridge money that had already arrived. A transfer that
   * worked deserves to say so in its own words, with the amounts it actually produced
   * rather than the ones it estimated an hour ago.
   *
   * The steps come from the same `RouteSteps` the plan was drawn with, ticked. Reusing
   * it is the point: a receipt spelled differently from the plan it is a receipt for
   * would be a second thing to keep true.
   */
  export let steps: RouteStep[] = [];
  export let receivedAmount: string;
  export let receivedSymbol: string;
  export let receivedUsd: number | null = null;
  export let routeSummary: string = "";
  /** The received token's own artwork, when the list had any. */
  export let tokenIcon: string = "";
  /** The chain it arrived on, so the amount is not floating free of it. */
  export let chainName: string = "";
  export let chainIcon: string = "";
  /**
   * Start over.
   *
   * A callback prop rather than a dispatched event: the sheet is opened by
   * `openBottomSheet`, which spreads props onto the component and wires no listeners,
   * so an event fired here would go nowhere and the button would close the sheet having
   * changed nothing.
   */
  export let onReset: () => void = () => closeBottomSheet();

  /**
   * Every step ticked, and none marked failed.
   *
   * The progress flags are the plan's own; a receipt is only ever shown for a
   * transfer that completed, so re-deriving them from the step count keeps the sheet
   * from being handed a half-finished list that would render a spinner in a receipt.
   */
  $: completed = steps.map((step) => ({ ...step, state: "done" as const }));

  function startAnother() {
    // Reset first, then close: closing first would dismiss the receipt over a form
    // still showing the finished transfer, which is the state the receipt exists to
    // replace.
    onReset();
    closeBottomSheet();
  }
</script>

<div class="p-4 pb-6 text-shitzu-1">
  <div class="text-center">
    <div
      class="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-shitzu-4/25 text-xl text-shitzu-1"
      aria-hidden="true"
    >
      <span class="i-mdi-check" />
    </div>
    <h2 class="text-base font-semibold text-shitzu-1">Conversion complete</h2>
    {#if routeSummary}
      <p class="mt-1 text-xs text-shitzu-2">{routeSummary}</p>
    {/if}
  </div>

  <!--
    What arrived, at the top, because it is the only number the user came for. The
    estimate it replaces is on the plan they signed; this is what the chain says.

    The token's own artwork and the chain it landed on are both here, because the
    figure means nothing without them: an amount and a ticker on a dark sheet is a
    string, whereas an amount beside the coin it is denominated in is a balance. The
    icon falls back to a placeholder rather than to nothing, which is what the pickers
    do, and the chain icon is best-effort for the same reason.
  -->
  <div class="mt-4 rounded-xl bg-white/5 border border-shitzu-4/45 p-3">
    <div class="text-xs uppercase tracking-wide text-shitzu-3">
      You received
    </div>
    <div class="mt-2 flex items-center gap-2.5">
      {#if tokenIcon}
        <img
          src={tokenIcon}
          alt=""
          class="h-7 w-7 shrink-0 rounded-full"
          loading="lazy"
        />
      {:else}
        <span
          class="h-7 w-7 shrink-0 rounded-full bg-shitzu-4/20"
          aria-hidden="true"
        />
      {/if}
      <span class="text-lg font-semibold text-shitzu-1">
        {receivedAmount}
        {receivedSymbol}
      </span>
      {#if chainIcon}
        <img
          src={chainIcon}
          alt={chainName}
          title={chainName}
          class="ml-auto h-4 w-4 shrink-0 rounded-full"
          loading="lazy"
        />
      {/if}
    </div>
    {#if receivedUsd !== null}
      <div class="mt-1 text-xs text-shitzu-2">{formatUsd(receivedUsd)}</div>
    {/if}
  </div>

  <div class="mt-3">
    <div
      class="text-xs font-semibold uppercase tracking-wide text-shitzu-3 mb-2"
    >
      What happened
    </div>
    <RouteSteps steps={completed} />
  </div>

  <button
    type="button"
    class="mt-4 w-full rounded-xl bg-shitzu-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-shitzu-5"
    on:click={startAnother}
  >
    Start another conversion
  </button>
</div>
