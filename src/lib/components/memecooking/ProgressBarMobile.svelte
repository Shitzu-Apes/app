<script lang="ts">
  import { fade } from "svelte/transition";

  import type { Meme } from "$lib/api/client";
  import { FixedNumber } from "$lib/util";

  export let meme: Meme;

  $: softCap = new FixedNumber(meme.soft_cap, 24);
  $: hardCap = meme.hard_cap ? new FixedNumber(meme.hard_cap, 24) : null;
  $: totalDeposit = new FixedNumber(meme.total_deposit, 24);

  $: progress = hardCap
    ? totalDeposit.div(hardCap).toNumber()
    : totalDeposit.div(softCap).toNumber();
  $: animatedWidth = Math.min(progress, 1.2);

  const explosionDelay = 2000 / Math.min(progress, 1.2) - 300;
  let explode = false;
  setTimeout(() => {
    explode = true;
    setTimeout(() => {
      explode = false;
    }, 300);
  }, explosionDelay);
</script>

<div
  class="w-full h-6 bg-gray-3 relative border-2 border-current {BigInt(
    meme.total_deposit,
  ) < BigInt(meme.soft_cap ?? 0)
    ? 'text-red-5'
    : BigInt(meme.total_deposit) >= BigInt(meme.soft_cap ?? 0)
      ? 'text-shitzu-4'
      : 'text-lime-4'}"
>
  <div
    class="h-full bg-current absolute top-0 left-0 transition-width duration-2000 animate-ease-linear rounded-r-full"
    style={`width: ${animatedWidth * 100}%`}
  ></div>
  <div
    class="h-full absolute top-0 right-2 text-gray-8 font-medium flex items-center justify-center"
  >
    {(progress * 100).toFixed(2)}%
  </div>
  {#if progress > 1 && explode}
    <img
      out:fade
      src="/animations/explosion.gif"
      alt="Explosion"
      class="absolute top-0 right-0 transform translate-x-1/2 -translate-y-full w-30 aspect-[150/97] object-cover"
    />
    <img
      out:fade
      src="/animations/explosion.gif"
      alt="Explosion"
      class="absolute top-0 right-0 transform translate-x-1/2 w-30 aspect-[150/97] object-cover rotate-180"
    />
  {/if}
  {#if meme.soft_cap && meme.hard_cap}
    <div
      class="absolute top-1/2 flex items-center flex-col"
      style={`left: calc(${Number((BigInt(meme.soft_cap ?? 0) * BigInt(100_00)) / BigInt(meme.hard_cap ?? 0)) / 100}% - 12px)`}
    >
      <div
        class="i-mdi:arrow-up-bold size-6 text-lime-4 animate-bounce animate-duration-300"
      ></div>
      <div class="text-xs text-lime-4">Soft Cap</div>
    </div>
  {/if}
</div>
