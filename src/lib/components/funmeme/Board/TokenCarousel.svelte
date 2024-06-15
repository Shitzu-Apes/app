<script lang="ts">
  import {
    type EmblaCarouselType,
    type EmblaOptionsType,
  } from "embla-carousel";
  import embalaCarousel from "embla-carousel-svelte";

  import TokenDetailCarousel from "./TokenDetailCarousel.svelte";
  let emblaApi: EmblaCarouselType | undefined = undefined;
  let options: EmblaOptionsType = {
    axis: "y",
  };

  function prev() {
    emblaApi?.scrollPrev();
  }

  function next() {
    emblaApi?.scrollNext();
  }
</script>

<div
  class="overflow-hidden relative"
  use:embalaCarousel={{ options, plugins: [] }}
  on:emblaInit={(event) => {
    emblaApi = event.detail;
    emblaApi.slideNodes();
  }}
>
  <div class="flex flex-col h-screen">
    <div class="flex-[0_0_100%] min-h-0">
      <TokenDetailCarousel />
    </div>
    <div class="flex-[0_0_100%] min-h-0">
      <TokenDetailCarousel />
    </div>
    <div class="flex-[0_0_100%] min-h-0">
      <TokenDetailCarousel />
    </div>
  </div>
  <button on:click={prev} class="absolute left-1/2 top-0 -translate-x-1/2">
    <div class="i-mdi:chevron-up size-12 text-shitzu-4/75" />
  </button>
  <button on:click={next} class="absolute left-1/2 bottom-0 -translate-x-1/2">
    <div class="i-mdi:chevron-down size-12 text-shitzu-4/75" />
  </button>
</div>
