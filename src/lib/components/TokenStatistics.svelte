<script lang="ts">
  import { fade } from "svelte/transition";

  import type { TokenInfo } from "$lib/store";
  import { FixedNumber } from "$lib/util";

  export let icon: string | undefined = undefined;
  export let token: TokenInfo;
  export let apr: FixedNumber;
  export let hasNft: boolean | undefined = undefined;
  export let showNftApr: boolean | undefined = undefined;
</script>

<div class="rounded-lg py-1 shadow text-end flex items-center gap-2 mr-6">
  <div class="flex items-center gap-2">
    {#if icon != null || token.icon != null}
      <img
        class="rounded-full size-5"
        src={icon ?? token.icon}
        alt={token.symbol}
      />
    {/if}
    <span class="pr-10">{token.symbol.toUpperCase()}</span>
  </div>
  <span class="flex-1">
    {#await hasNft then hasNft}
      {#if hasNft}
        {apr.format({
          maximumFractionDigits: 2,
        })}%
      {:else if showNftApr}
        {apr.format({
          maximumFractionDigits: 2,
        })}%
        <span class="text-green-3" in:fade>
          (+{apr.mul(new FixedNumber(2n, 1)).format({
            maximumFractionDigits: 2,
          })}%)</span
        >
      {:else}
        {apr.mul(new FixedNumber(8n, 1)).format({
          maximumFractionDigits: 2,
        })}%
      {/if}
    {/await}
  </span>
</div>
