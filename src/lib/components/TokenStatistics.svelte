<script lang="ts">
  import { FixedNumber } from "@tarnadas/fixed-number";

  import type { TokenInfo } from "$lib/store";

  export let icon: string | undefined = undefined;
  export let token: TokenInfo;
  export let apr: FixedNumber;
</script>

<div class="rounded-lg py-1 shadow text-end flex items-center gap-2">
  {#if icon != null || token.icon != null}
    <img
      class="rounded-full size-5"
      src={icon ?? token.icon}
      alt={token.symbol}
    />
  {/if}
  <span class="flex-1">
    <span class="hidden md:inline">{token.symbol.toUpperCase()}</span>
    {apr.format({
      maximumFractionDigits: 2,
    })}%
  </span>
</div>
