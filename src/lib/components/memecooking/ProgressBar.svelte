<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";

  import { MCsubscribe } from "$lib/store/memebids";
  import { FixedNumber } from "$lib/util";

  export let progress: number;
  export let meme_id: number;
  export let required_stake: string;
  let animatedWidth = 0;
  setTimeout(() => {
    animatedWidth = Math.min(progress, 1.2);
  });

  const explosionDelay = 2_000 / Math.min(progress, 1.2) - 300;
  console.log("explosionDelay", explosionDelay);
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

  const symbol = Symbol();
  onMount(() => {
    MCsubscribe(symbol, (meme) => {
      if (meme.meme_id !== meme_id) return;
      console.log("[ProgressBar] meme_id", meme_id);
      progress = new FixedNumber(meme.total_deposit, 24)
        .div(new FixedNumber(required_stake, 24))
        .toNumber();
    });
  });
</script>

<div class="mb-2">Staking progress: {(progress * 100).toFixed(2)}%</div>
<div
  class="w-full h-5 bg-gray-3 {progress > 0.5
    ? progress > 1
      ? 'text-shitzu-4'
      : 'text-amber-5'
    : 'text-red-5'} rounded-lg relative border-2 border-current"
>
  <div
    class="h-3 bg-current rounded-lg absolute top-0.5 left-0.5 transition-width duration-2000 animate-ease-linear"
    style={`width: ${animatedWidth * 100}%`}
  ></div>
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

  {#if progress > 1 && mindBlown}
    <div
      transition:fade
      class="absolute top-0 mxa overflow-visible z-10 pointer-events-none w-[320px] h-[210px] opacity-50"
      style="background: url('/animations/mind-blown.gif'); background-size: 320px 210px; left: calc(50% - 160px);"
    ></div>
  {/if}
</div>
