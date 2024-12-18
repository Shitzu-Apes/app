<script lang="ts">
  import { createPoolStatQuery } from "$lib/api/queries/poolStat";
  import type { Meme } from "$lib/models/memecooking";

  export let meme: Meme;
  const poolStatQuery = createPoolStatQuery(meme);
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
