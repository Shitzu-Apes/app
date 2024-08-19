<script lang="ts">
  import { onMount } from "svelte";

  import MemePreview from "./Desktop/MemePreview.svelte";

  import type { Meme } from "$lib/api/client";
  import { MCTradeSubscribe, MCunsubscribe } from "$lib/store/memebids";
  import type { FixedNumber } from "$lib/util";

  export let king: Meme | undefined;
  export let requiredStake: FixedNumber;

  let MCSymbol = Symbol();
  onMount(() => {
    MCTradeSubscribe(MCSymbol, (meme) => {
      if (
        meme.coronated_at_ms &&
        king?.coronated_at_ms &&
        (!king || meme.coronated_at_ms > king.coronated_at_ms)
      ) {
        king = meme;
      }
    });

    return () => {
      MCunsubscribe(MCSymbol);
    };
  });
</script>

{#if king}
  <div class="max-w-lg">
    <MemePreview memebid={king} {requiredStake} />
  </div>
{:else}
  <div class="flex gap-4 items-center">
    <div class="loader size-24" />
    <div class="flex flex-col gap-2">
      <!-- Created by -->
      <div class="loader w-40 h-4" />
      <!-- MCap -->
      <div class="loader w-50 h-4" />
      <!-- replies -->
      <div class="loader w-20 h-2" />
      <!-- Ticker -->
      <div class="loader w-50 h-5" />
    </div>
  </div>
{/if}
