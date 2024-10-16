<script lang="ts">
  import { fade } from "svelte/transition";

  import type { Meme } from "$lib/api/client";
  import { createProgressBarData } from "$lib/util/progressBarLogic";

  export let meme: Meme;

  let explode = false;
  let {
    hardCap,
    progress,
    softcapProgress,
    hardCapProgress,
    softHardCapRatio,
    animatedWidth,
    explosionDelay,
  } = createProgressBarData(meme);

  $: {
    ({
      hardCap,
      progress,
      softcapProgress,
      hardCapProgress,
      softHardCapRatio,
      animatedWidth,
      explosionDelay,
    } = createProgressBarData(meme));

    // Explosion effect
    if (progress >= 1) {
      setTimeout(() => {
        explode = true;
        setTimeout(() => {
          explode = false;
        }, 300);
      }, explosionDelay);
    }
  }
</script>

<div class="w-full h-6 relative">
  {#if hardCap}
    <div class="flex items-center h-full gap-1.5">
      <div
        class="relative h-full bg-gray-3 border-2 border-current {softcapProgress <
        1
          ? 'text-red-5'
          : 'text-shitzu-4'}"
        style={`width: ${softHardCapRatio * 100}%`}
      >
        <div
          class="h-full bg-current absolute top-0 left-0 transition-all duration-[2000ms] ease-linear"
          style={`width: ${(Math.min(softcapProgress, 1) * 100).toFixed(2)}%`}
        ></div>
      </div>
      <div
        class="relative h-full bg-gray-3 border-2 border-current flex-1 {softcapProgress <
        1
          ? 'text-red-5'
          : hardCapProgress > 0
            ? 'text-lime-4'
            : 'text-gray-3'}"
      >
        <div
          class="h-full bg-current absolute top-0 left-0 transition-all duration-[2000ms] ease-linear"
          style={`width: ${(Math.min(hardCapProgress, 1) * 100).toFixed(2)}%`}
        ></div>
      </div>
    </div>
    <div
      class="h-full absolute top-0 right-2 text-gray-8 font-medium flex items-center justify-center"
    >
      {(progress * 100).toFixed(2)}%
    </div>
  {:else}
    <div
      class="w-full h-full bg-gray-3 relative border-2 border-current {softcapProgress <
      1
        ? 'text-red-5'
        : 'text-shitzu-4'}"
    >
      <div
        class="h-full bg-current absolute top-0 left-0 transition-all duration-[2000ms] ease-linear"
        style={`width: ${animatedWidth * 100}%`}
      ></div>
      <div
        class="h-full absolute top-0 right-2 text-gray-8 font-medium flex items-center justify-center"
      >
        {(progress * 100).toFixed(2)}%
      </div>
    </div>
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
</div>
