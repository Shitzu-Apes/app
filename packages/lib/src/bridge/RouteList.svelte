<script lang="ts">
  import { createEventDispatcher } from "svelte";

  import { formatBaseUnitsCompact } from "$lib/bridge/amount";
  import { describePlan, planKey, type RoutePlan } from "$lib/bridge/search";
  import { percentBehind } from "$lib/bridge/steps";

  /**
   * The routes the search found, best first.
   *
   * Every rail that can carry the transfer is shown rather than only the winner,
   * because the winner is frequently not the one the user would have picked. A
   * fixed wNEAR rail is the obvious default and often the wrong one: routing USDC
   * to SHITZU on Solana through wNEAR cannot complete at all, because Jupiter
   * will not trade SHITZU there, while swapping to SHITZU on NEAR first needs no
   * second swap. Hiding the alternatives would make that look like a dead market.
   *
   * Ranking is on the guaranteed figure, so the headline number on each row is
   * the floor, not the estimate. The estimate is shown beside it when the two
   * differ enough to matter, because a route that might deliver more is worth
   * knowing about even if it is not what is being ranked.
   */
  export let plans: RoutePlan[];
  export let selectedRailId: string | undefined = undefined;
  export let pending = false;

  /** Picking a row pins that rail, overriding the ranking. */
  const dispatch = createEventDispatcher<{ select: string }>();

  /** A floor below this share of the estimate is not worth mentioning. */
  const SPREAD_THRESHOLD = 0.9;

  function hasSpread(plan: RoutePlan): boolean {
    if (plan.receiveAmount === null || plan.receiveEstimated === null)
      return false;
    if (plan.receiveEstimated <= 0n) return false;
    return (
      Number(plan.receiveAmount) / Number(plan.receiveEstimated) <
      SPREAD_THRESHOLD
    );
  }

  function swapCount(plan: RoutePlan): number {
    return (plan.sourceSwap ? 1 : 0) + (plan.targetSwap ? 1 : 0);
  }

  /**
   * How far each route is behind the best one.
   *
   * Measured against the first row rather than a separate maximum, so pinning a
   * different route still shows every row's distance from the one actually on
   * offer. Computed once per list rather than per row, so the percentage shown
   * and the percentage the sort used cannot disagree.
   */
  $: behindById = new Map(
    plans.map((p) => [planKey(p), percentBehind(p, plans[0])]),
  );

  function behindOf(plan: RoutePlan): number | null {
    return behindById.get(planKey(plan)) ?? null;
  }
</script>

{#if pending}
  <div class="flex flex-col gap-1.5" aria-busy="true">
    {#each [0, 1] as row (row)}
      <div
        class="h-11 rounded-lg bg-shitzu-4/20 animate-pulse"
        aria-hidden="true"
      />
    {/each}
    <span class="sr-only">Searching for a route</span>
  </div>
{:else if plans.length === 0}
  <div class="text-sm text-shitzu-2">
    No way to move that right now. Every token that can be bridged between these
    two chains was checked.
  </div>
{:else}
  <div class="flex flex-col gap-1.5">
    {#each plans as plan, index (planKey(plan))}
      <button
        type="button"
        class="w-full text-left rounded-lg border px-3 py-2 transition-colors {selectedRailId ===
        planKey(plan)
          ? 'border-lime bg-lime/10'
          : 'border-shitzu-4/30 hover:border-lime/50'}"
        on:click={() => dispatch("select", planKey(plan))}
        aria-pressed={selectedRailId === planKey(plan)}
      >
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            {#if index === 0}
              <span
                class="shrink-0 text-[10px] uppercase tracking-wide text-lime font-semibold"
              >
                Best
              </span>
            {/if}
            <span class="text-sm truncate">{describePlan(plan)}</span>
          </div>
          <div class="flex items-baseline gap-2 shrink-0">
            {#if (behindOf(plan) ?? 0) > 0}
              <!--
                The gap to the best route, as a percentage of what the best one
                delivers. Ranking already puts the best first, so this is how a
                user judges whether the alternative they prefer is worth the
                difference — the absolute numbers are not comparable between rows.
              -->
              <span class="text-xs text-amber-300">−{behindOf(plan)}%</span>
            {/if}
            <span class="text-sm font-semibold">
              {plan.receiveAmount === null
                ? "—"
                : formatBaseUnitsCompact(
                    plan.receiveAmount,
                    plan.targetDecimals,
                  )}
              {plan.targetSymbol}
            </span>
          </div>
        </div>

        <div class="flex items-center justify-between gap-2 mt-0.5">
          <span class="text-xs text-shitzu-2">
            {#if swapCount(plan) === 0}
              Straight bridge, no swap
            {:else}
              {swapCount(plan)} swap{swapCount(plan) === 1 ? "" : "s"} ·
              {[
                ...(plan.sourceSwap?.dexes ?? []),
                ...(plan.targetSwap?.dexes ?? []),
              ].join(" → ")}
            {/if}
          </span>
          {#if hasSpread(plan)}
            <span class="text-xs text-amber-300 shrink-0">
              up to {formatBaseUnitsCompact(
                plan.receiveEstimated ?? 0n,
                plan.targetDecimals,
              )}
            </span>
          {/if}
        </div>
      </button>
    {/each}
  </div>
{/if}
