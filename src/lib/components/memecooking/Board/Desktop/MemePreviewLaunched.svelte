<script lang="ts">
  import { createRefGetPoolQuery } from "$lib/api/queries/ref";
  import type { Meme } from "$lib/models/memecooking";
  import type { FixedNumber } from "$lib/util";
  import { calculateTokenStatsFromPoolInfo } from "$lib/util/projectedMCap";

  export let memebid: Meme;
  export let nearPrice: FixedNumber;

  const poolStatQuery = createRefGetPoolQuery(memebid.pool_id!);
</script>

<div class="flex flex-col">
  <div class="flex items-center gap-1">
    <span class="text-memecooking-400">MC:</span>
    <span class="font-medium">
      {#if $poolStatQuery.isLoading}
        <div class="i-svg-spinners:bars-fade size-4" />
      {:else if $poolStatQuery.isError}
        <div class="i-mdi:alert-circle text-rose-4" />
        {$poolStatQuery.error}
      {:else if $poolStatQuery.data}
        ${calculateTokenStatsFromPoolInfo(
          memebid,
          $poolStatQuery.data,
          memebid.decimals,
        )
          .mcap.mul(nearPrice)
          .format({
            maximumFractionDigits: 3,
            notation: "compact",
          })}
      {/if}
    </span>
  </div>
  <div class="flex items-center gap-1">
    <span class="text-memecooking-400">L:</span>
    <span class="font-medium">
      {#if $poolStatQuery.isLoading}
        <div class="i-svg-spinners:bars-fade size-4" />
      {:else if $poolStatQuery.isError}
        <div class="i-mdi:alert-circle text-rose-4" />
      {:else if $poolStatQuery.data}
        ${calculateTokenStatsFromPoolInfo(
          memebid,
          $poolStatQuery.data,
          memebid.decimals,
        )
          .liquidity.mul(nearPrice)
          .format({
            maximumFractionDigits: 3,
            notation: "compact",
          })}
      {/if}
    </span>
  </div>
</div>
