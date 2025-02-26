<script lang="ts">
  import { useMemeStatsQuery } from "$lib/api/queries/memeStats";
  import type { Meme } from "$lib/models/memecooking";

  export let memebid: Meme;

  const statsQuery = useMemeStatsQuery(memebid.meme_id);
</script>

<div class="flex flex-col">
  <div class="flex items-center gap-1">
    <span class="text-memecooking-400">MC:</span>
    <span class="font-medium">
      {#if $statsQuery.isLoading}
        <div class="i-svg-spinners:bars-fade size-4" />
      {:else if $statsQuery.isError}
        <div class="i-mdi:alert-circle text-rose-4" />
        {$statsQuery.error}
      {:else if $statsQuery.data}
        ${$statsQuery.data.mcap.usd.format({
          maximumFractionDigits: 3,
          notation: "compact",
        })}
      {/if}
    </span>
  </div>
  <div class="flex items-center gap-1">
    <span class="text-memecooking-400">L:</span>
    <span class="font-medium">
      {#if $statsQuery.isLoading}
        <div class="i-svg-spinners:bars-fade size-4" />
      {:else if $statsQuery.isError}
        <div class="i-mdi:alert-circle text-rose-4" />
      {:else if $statsQuery.data}
        ${$statsQuery.data.liquidity.usd.format({
          maximumFractionDigits: 3,
          notation: "compact",
        })}
      {/if}
    </span>
  </div>
</div>
