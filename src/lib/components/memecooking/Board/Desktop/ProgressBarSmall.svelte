<script lang="ts">
  import { fade } from "svelte/transition";

  import type { Meme } from "$lib/api/client";
  import ExtraDetail from "$lib/components/ExtraDetail.svelte";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import { FixedNumber } from "$lib/util";

  export let meme: Meme;

  $: softCap = new FixedNumber(meme.soft_cap, 24);
  $: hardCap = meme.hard_cap ? new FixedNumber(meme.hard_cap, 24) : null;
  $: totalDeposit = new FixedNumber(meme.total_deposit, 24);

  $: progress = hardCap
    ? totalDeposit.div(hardCap).toNumber()
    : totalDeposit.div(softCap).toNumber();

  $: softcapProgress = totalDeposit.div(softCap).toNumber();

  $: hardCapProgress =
    hardCap && hardCap.valueOf() !== softCap.valueOf()
      ? Number(
          ((totalDeposit.toBigInt() - softCap.toBigInt()) * 10000n) /
            (hardCap.toBigInt() - softCap.toBigInt()),
        ) / 10000
      : 0;

  $: softHardCapRatio = hardCap ? softCap.div(hardCap).toNumber() : 0;

  $: animatedWidth = Math.min(progress, 1.2);

  // Explosion effect
  const explosionDelay = 2000 / Math.min(progress, 1.2) - 300;
  let explode = false;
  $: if (progress >= 1) {
    setTimeout(() => {
      explode = true;
      setTimeout(() => {
        explode = false;
      }, 300);
    }, explosionDelay);
  }
</script>

<Tooltip class="w-full">
  <slot slot="info">
    <ExtraDetail class="w-80 p-2 text-sm" {meme} />
  </slot>

  <div class="w-full h-1 relative">
    {#if hardCap}
      <div class="flex items-center h-full gap-0.5">
        <div
          class="relative h-full bg-gray-3 border {softcapProgress < 1
            ? 'border-red-5'
            : 'border-shitzu-4'}"
          style={`width: ${softHardCapRatio * 100}%`}
        >
          <div
            class="h-full absolute top-0 left-0 transition-all duration-2000 ease-linear {softcapProgress <
            1
              ? 'bg-gradient-to-r from-red-500 to-rose-600'
              : 'bg-shitzu-4'}"
            style={`width: ${(Math.min(softcapProgress, 1) * 100).toFixed(2)}%`}
          ></div>
        </div>
        <div
          class="relative h-full bg-gray-3 border flex-1 {softcapProgress < 1
            ? 'border-red-5'
            : hardCapProgress > 0
              ? 'border-lime-4'
              : 'border-gray-3'}"
        >
          <div
            class="h-full absolute top-0 left-0 transition-all duration-2000 ease-linear {hardCapProgress >
            0
              ? 'bg-gradient-to-r from-shitzu-4 to-lime-4'
              : ''}"
            style={`width: ${(Math.min(hardCapProgress, 1) * 100).toFixed(2)}%`}
          ></div>
        </div>
      </div>
    {:else}
      <div
        class="w-full h-full bg-gray-3 relative border {softcapProgress < 1
          ? 'border-red-5'
          : 'border-shitzu-4'}"
      >
        <div
          class="h-full absolute top-0 left-0 transition-all duration-2000 ease-linear {softcapProgress <
          1
            ? 'bg-gradient-to-r from-red-500 to-rose-600'
            : 'bg-shitzu-4'}"
          style={`width: ${animatedWidth * 100}%`}
        ></div>
      </div>
    {/if}
  </div>
</Tooltip>

{#if progress >= 1 && explode}
  <img
    out:fade
    src="/animations/explosion.gif"
    alt="Explosion"
    class="absolute top-0 right-0 transform translate-x-1/2 -translate-y-full w-20 aspect-[150/97] object-cover"
  />
  <img
    out:fade
    src="/animations/explosion.gif"
    alt="Explosion"
    class="absolute top-0 right-0 transform translate-x-1/2 w-20 aspect-[150/97] object-cover rotate-180"
  />
{/if}
