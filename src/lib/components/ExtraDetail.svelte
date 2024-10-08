<script lang="ts">
  import { slide } from "svelte/transition";

  import type { Meme } from "$lib/models/memecooking";
  import { FixedNumber } from "$lib/util";

  export let meme: Meme;

  let className: string = "";
  export { className as class };

  export let expanded: boolean = false;

  const SHORT_COPY = `The total supply of ${meme.symbol} is ${new FixedNumber(
    meme.total_supply,
    meme.decimals,
  ).format()}.`;

  const softCap = new FixedNumber(meme.soft_cap ?? "0", 24);
  const hardCap = new FixedNumber(meme.hard_cap ?? "0", 24);
  const hardCapEnabled = meme.hard_cap && BigInt(meme.hard_cap) > 0;

  const FULL_COPY = `
  ${SHORT_COPY} Half of this supply, plus ${new FixedNumber(
    meme.total_deposit,
    24,
  ).format()} NEAR, will be used for liquidity and burned. The remaining half will
  be shared among depositors. The Soft Cap of ${softCap.format()} NEAR is
  the minimum required to launch on ref once the duration is over. 
    ${hardCapEnabled ? `If the Hard Cap of ${hardCap.format()} NEAR is reached, it will trigger an immediate launch.` : ""}
  `;
</script>

<div class="{className} overflow-hidden">
  {#if expanded}
    <div transition:slide|local>
      {FULL_COPY}
      <button class="text-lightblue-3" on:click={() => (expanded = false)}
        >less</button
      >
    </div>
  {:else}
    <div transition:slide|local>
      {SHORT_COPY}
      <button class="text-lightblue-3" on:click={() => (expanded = true)}
        >more</button
      >
    </div>
  {/if}
</div>
