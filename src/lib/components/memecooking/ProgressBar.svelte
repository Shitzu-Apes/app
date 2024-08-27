<script lang="ts">
  import { fade } from "svelte/transition";

  export let progress: number;
  export let textVisible = true;
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

{#if textVisible}
  <div class="mb-2 text-shitzu-4">progress: {(progress * 100).toFixed(2)}%</div>
{/if}
<div
  class="w-full h-5 bg-gray-3 {progress > 0.5
    ? progress >= 1
      ? 'text-shitzu-4'
      : 'text-amber-5'
    : 'text-red-5'} relative border-2 border-current"
>
  <div
    class="h-3 absolute top-0.5 left-0.5 transition-width duration-2000"
    style={`width: ${animatedWidth * 100}%`}
  >
    <div
      class="w-full h-full animate-ease-linear animate-pulse animate-duration-500 {progress >
      0.5
        ? progress >= 1
          ? 'bg-gradient-to-r from-green-400 to-shitzu-4'
          : 'bg-gradient-to-r from-yellow-400 to-amber-500'
        : 'bg-gradient-to-r from-red-500 to-rose-600'}"
    ></div>
    <div
      class="absolute -top-7 -right-3 transform translate-x-1/2 -translate-y-full w-fit animate-bounce animate-duration-300"
    >
      <div class="i-mdi:arrow-down-bold size-6" />
    </div>
  </div>
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
