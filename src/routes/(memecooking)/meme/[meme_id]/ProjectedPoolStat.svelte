<script lang="ts">
  import { createRefGetPoolQuery } from "$lib/api/queries/ref";
  import type { Meme } from "$lib/models/memecooking";
  import { calculateTokenStatsFromPoolInfo } from "$lib/util/projectedMCap";

  export let meme: Meme;
  const poolStatQuery = createRefGetPoolQuery(meme.meme_id);
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
        ${calculateTokenStatsFromPoolInfo(
          meme,
          $poolStatQuery.data,
          meme.decimals,
        ).liquidity.format({
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
        ${calculateTokenStatsFromPoolInfo(
          meme,
          $poolStatQuery.data,
          meme.decimals,
        ).mcap.format({
          maximumFractionDigits: 3,
          notation: "compact",
        })}
      {:else}
        -
      {/if}
    </div>
  </div>
</div>
