<script lang="ts">
  import { slide } from "svelte/transition";

  import type { Meme } from "$lib/models/memecooking";
  import { FixedNumber } from "$lib/util";

  export let meme: Meme;

  let className: string = "";
  export { className as class };

  let expanded: boolean = false;

  const SHORT_COPY = `The total supply of ${meme.symbol} is ${new FixedNumber(
    meme.total_supply,
    meme.decimals,
  ).format()}.`;

  const FULL_COPY = `
  ${SHORT_COPY} Half of this supply, plus ${new FixedNumber(
    meme.total_deposit,
    24,
  ).format()} NEAR, will be used for liquidity and burned. The remaining half will
  be shared among depositors.
  `;
</script>

<div class="{className} overflow-hidden">
  {#if expanded}
    <div transition:slide|local>
      {FULL_COPY}
      <button on:click={() => (expanded = false)}>less</button>
    </div>
  {:else}
    <div transition:slide|local>
      {SHORT_COPY}
      <button on:click={() => (expanded = true)}>more</button>
    </div>
  {/if}
</div>
