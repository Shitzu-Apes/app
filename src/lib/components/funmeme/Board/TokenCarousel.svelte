<script lang="ts">
  import {
    type EmblaCarouselType,
    type EmblaOptionsType,
  } from "embla-carousel";
  import embalaCarousel from "embla-carousel-svelte";
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

<button on:click={prev}>Prev</button>
<button on:click={next}>Next</button>
<div
  class="overflow-hidden"
  use:embalaCarousel={{ options, plugins: [] }}
  on:emblaInit={(event) => {
    emblaApi = event.detail;
    emblaApi.slideNodes();
  }}
>
  <div class="flex flex-col h-screen">
    <div class="flex-[0_0_100%] min-h-0">Slide 1</div>
    <div class="flex-[0_0_100%] min-h-0">Slide 2</div>
    <div class="flex-[0_0_100%] min-h-0">Slide 3</div>
  </div>
</div>
