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

  const tokens = [...new Array(20).keys()];

  function prev() {
    emblaApi?.scrollPrev();
  }

  function next() {
    emblaApi?.scrollNext();
  }

  let selected = 0;
</script>

<svelte:window
  on:keydown={(event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const focus = document.querySelector(".focus-element");

      const focusTop = focus?.getBoundingClientRect().top;

      if (focusTop !== 0) {
        document.querySelector(".focus-element")?.scrollIntoView({
          behavior: "smooth",
        });
      } else {
        next();
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (emblaApi?.canScrollPrev()) {
        prev();
      } else {
        scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }
    }
  }}
/>
<div
  class="overflow-hidden relative focus-element"
  use:embalaCarousel={{ options, plugins: [] }}
  on:emblaInit={(event) => {
    emblaApi = event.detail;
    emblaApi.slideNodes();

    emblaApi.on("select", () => {
      if (emblaApi) {
        selected = emblaApi.selectedScrollSnap();
      }
    });
  }}
>
  <div class="flex flex-col h-screen">
    {#each tokens as token, i (token)}
      <div class="flex-[0_0_100%] min-h-0">
        <TokenDetailCarousel focused={selected === i} id={i} />
      </div>
    {/each}
  </div>
  <!-- <button on:click={prev} class="absolute left-1/2 top-0 -translate-x-1/2">
    <div class="i-mdi:chevron-up size-12 text-shitzu-4/75" />
  </button>
  <button on:click={next} class="absolute left-1/2 bottom-0 -translate-x-1/2">
    <div class="i-mdi:chevron-down size-12 text-shitzu-4/75" />
  </button> -->
</div>
