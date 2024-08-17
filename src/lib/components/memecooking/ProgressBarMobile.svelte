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
</script>

{#if textVisible}
  <div class="mb-2">Staking progress: {(progress * 100).toFixed(2)}%</div>
{/if}
<div
  class="w-full h-6 bg-gray-3 {progress > 0.5
    ? progress > 1
      ? 'text-shitzu-4'
      : 'text-amber-5'
    : 'text-red-5'} relative"
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
</div>
