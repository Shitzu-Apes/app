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

  const explosionDelay = 2_000 / Math.min(progress, 1.2) - 300;
  let explode = false;
  setTimeout(() => {
    explode = true;
    setTimeout(() => {
      explode = false;
    }, 300);
  }, explosionDelay);
  let mindBlown = false;
  setTimeout(() => {
    mindBlown = true;
    setTimeout(() => {
      mindBlown = false;
    }, 1_700);
  }, explosionDelay);
</script>

<div
  class="w-full h-5 bg-gray-3 relative border-2 {BigInt(meme.total_deposit) <
  BigInt(meme.soft_cap ?? 0)
    ? 'border-red-5'
    : BigInt(meme.total_deposit) >= BigInt(meme.hard_cap ?? 0)
      ? 'border-shitzu-4'
      : 'border-lime-4'}"
>
  <div
    class="h-3 absolute top-0.5 left-0.5 transition-width duration-2000"
    style={`width: ${animatedWidth * 100}%`}
  >
    <div
      class="w-full h-full animate-ease-linear animate-pulse animate-duration-500 {BigInt(
        meme.total_deposit,
      ) < BigInt(meme.soft_cap ?? 0)
        ? 'bg-gradient-to-r from-red-500 to-rose-600'
        : BigInt(meme.total_deposit) >= BigInt(meme.hard_cap ?? 0)
          ? 'bg-gradient-to-r from-shitzu-4 to-lime-4'
          : 'bg-gradient-to-r from-shitzu-4 to-lime-4'}"
    ></div>
    <div
      class="absolute -top-7 -right-3 transform translate-x-1/2 -translate-y-full w-fit animate-bounce animate-duration-300"
    >
      <div class="i-mdi:arrow-down-bold size-6" />
    </div>
  </div>
  {#if meme.soft_cap && meme.hard_cap}
    <div
      class="absolute -bottom-12 left-0 flex items-center flex-col"
      style={`left: calc(${Number((BigInt(meme.soft_cap ?? 0) * BigInt(100_00)) / BigInt(meme.hard_cap ?? 0)) / 100}% - 12px)`}
    >
      <div
        class="i-mdi:arrow-up-bold size-6 text-lime-4 animate-bounce animate-duration-300"
      />
      <div class="text-xs text-lime-4">Soft Cap</div>
    </div>
  {/if}
  {#if progress}
    <div
      class="h-3 absolute top-0.5 left-0.5 bg-shitzu-4 opacity-50"
      style={`width: ${progress * 100}%`}
    ></div>
  {/if}
  {#if progress >= 1 && explode}
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

  {#if progress >= 1 && mindBlown}
    <div
      transition:fade
      class="absolute top-0 mxa overflow-visible z-10 pointer-events-none w-[320px] h-[210px] opacity-50"
      style="background: url('/animations/mind-blown.gif'); background-size: 320px 210px; left: calc(50% - 160px);"
    ></div>
  {/if}
</div>
