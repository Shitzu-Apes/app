<script lang="ts">
  import { get } from "svelte/store";

  import type { Meme } from "$lib/models/memecooking";

  export let meme: Meme;
  $: projectedPoolStats = get(meme.projectedPoolStats!);

  $: console.log(
    "[meme::ProjectedPoolStat] projectedPoolStats",
    projectedPoolStats,
  );
</script>

<div class="flex items-center gap-6">
  <div class="text-center">
    <div class="text-sm text-gray-400">Liquidity</div>
    <div class="font-bold text-xl">
      {#if projectedPoolStats}
        ${projectedPoolStats.liquidity.format({
          maximumFractionDigits: 3,
          notation: "compact",
        })}
      {:else}
        -
      {/if}
    </div>
  </div>
  <div class="text-center">
    <div class="text-sm text-gray-400">Market Cap</div>
    <div class="font-bold text-xl">
      {#if projectedPoolStats}
        ${projectedPoolStats.mcap.format({
          maximumFractionDigits: 3,
          notation: "compact",
        })}
      {:else}
        -
      {/if}
    </div>
  </div>
</div>
