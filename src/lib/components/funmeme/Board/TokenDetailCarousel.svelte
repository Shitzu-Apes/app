<script lang="ts">
  import {
    type EmblaCarouselType,
    type EmblaOptionsType,
  } from "embla-carousel";
  import embalaCarousel from "embla-carousel-svelte";
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
</script>

<div
  class="overflow-hidden h-full relative"
  use:embalaCarousel={{ options, plugins: [] }}
  on:emblaInit={(event) => {
    emblaApi = event.detail;
    emblaApi.slideNodes();
  }}
>
  <div class="flex w-screen">
    <div class="flex-[0_0_100%] min-w-0">Detail 1</div>
    <div class="flex-[0_0_100%] min-w-0">Detail 2</div>
    <div class="flex-[0_0_100%] min-w-0">Detail 3</div>
  </div>
  <button class="absolute left-0 top-1/2 -translate-y-1/2" on:click={prev}>
    <div class="i-mdi:chevron-left size-12 text-shitzu-4/75" />
  </button>
  <button class="absolute right-0 top-1/2 -translate-y-1/2" on:click={next}>
    <div class="i-mdi:chevron-right size-12 text-shitzu-4/75" />
  </button>
</div>
