<script lang="ts">
  import { useMemeStatsQuery } from "$lib/api/queries/memeStats";
  import type { Meme } from "$lib/models/memecooking";

  export let meme: Meme;
  const poolStatQuery = useMemeStatsQuery(meme.meme_id);
</script>

<div class="flex items-center gap-6">
  <div class="text-center">
    <div class="text-sm text-gray-400">Liquidity</div>
    <div class="font-bold text-xl">
      {#if $poolStatQuery.isLoading}
        <div class="i-svg-spinners:bars-fade size-4" />
      {:else if $poolStatQuery.isError}
        <div class="i-mdi:alert-circle text-rose-4" />
      {:else if $poolStatQuery.data}
        ${$poolStatQuery.data.liquidity.format({
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
      {#if $poolStatQuery.isLoading}
        <div class="i-svg-spinners:bars-fade size-4" />
      {:else if $poolStatQuery.isError}
        <div class="i-mdi:alert-circle text-rose-4" />
      {:else if $poolStatQuery.data}
        ${$poolStatQuery.data.mcap.format({
          maximumFractionDigits: 3,
          notation: "compact",
        })}
      {:else}
        -
      {/if}
    </div>
  </div>
</div>
