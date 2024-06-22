<script lang="ts">
  import {
    type EmblaCarouselType,
    type EmblaOptionsType,
  } from "embla-carousel";
  import embalaCarousel from "embla-carousel-svelte";

  import FunMemeStake from "./FunMemeStake.svelte";
  import TokenChart from "./TokenChart.svelte";
  import TokenDetail from "./TokenDetail.svelte";
  import TokenHolder from "./TokenHolder.svelte";
  let emblaApi: EmblaCarouselType | undefined = undefined;
  let options: EmblaOptionsType = {
    axis: "x",
  };

  function prev() {
    emblaApi?.scrollPrev();
  }

  function next() {
    emblaApi?.scrollNext();
  }

  export let focused = false;

  let renderChart = false;

  $: {
    setTimeout(() => {
      if (focused && !renderChart) {
        renderChart = true;
      }
    }, 1000);
  }
</script>

<div
  class="overflow-hidden h-[70%] relative border-b border-shitzu-4"
  use:embalaCarousel={{ options, plugins: [] }}
  on:emblaInit={(event) => {
    emblaApi = event.detail;
    emblaApi.slideNodes();
  }}
>
  <div class="flex w-screen h-full">
    <div
      class="flex-[0_0_100%] min-w-0 flex flex-col justify-center items-center h-full text-shitzu-4 gap-4"
    >
      <TokenDetail />
    </div>
    <div class="flex-[0_0_100%] min-w-0">
      {#if focused && renderChart}
        <TokenChart />
      {/if}
    </div>
    <div class="flex-[0_0_100%] min-w-0">
      <TokenHolder />
    </div>
  </div>
  <button class="absolute left-0 top-1/2 -translate-y-1/2" on:click={prev}>
    <div class="i-mdi:chevron-left size-12 text-shitzu-4/75" />
  </button>
  <button class="absolute right-0 top-1/2 -translate-y-1/2" on:click={next}>
    <div class="i-mdi:chevron-right size-12 text-shitzu-4/75" />
  </button>
</div>
<div class="h-[30%] w-full flex justify-center items-center pb-10 px-6">
  <FunMemeStake />
</div>
