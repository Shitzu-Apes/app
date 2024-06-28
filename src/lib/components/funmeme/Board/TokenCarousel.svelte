<script lang="ts">
  import {
    type EmblaCarouselType,
    type EmblaOptionsType,
  } from "embla-carousel";
  import embalaCarousel from "embla-carousel-svelte";

  import TokenDetailCarousel from "./TokenDetailCarousel.svelte";

  import { replaceState } from "$app/navigation";
  import { page } from "$app/stores";
  let emblaApi: EmblaCarouselType | undefined = undefined;
  let options: EmblaOptionsType = {
    axis: "y",
  };

  export let memebids;

  export let currentMemebidsIdx = 0;
  export let next: () => void;
  export let prev: () => void;
  export let isFunmemeHome: boolean;

  $: {
    const focus = document.querySelector(".focus-element");

    const focusTop = focus?.getBoundingClientRect().top;

    if (focusTop !== 0 && !isFunmemeHome) {
      document.querySelector(".focus-element")?.scrollIntoView({
        behavior: "smooth",
      });
    }
    emblaApi?.scrollTo(currentMemebidsIdx);
  }
  // function prev() {
  //   emblaApi?.scrollPrev();

  //   // update the url
  // }

  // function next() {
  //   emblaApi?.scrollNext();
  // }
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
        console.log("pagge", $page);
        if ($page.params.page === "board") {
          next();
        }
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
        if ($page.params.page !== "board") {
          replaceState("/board", $page.state);
        }
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
        currentMemebidsIdx = emblaApi.selectedScrollSnap();
      }
    });
  }}
>
  <div class="flex flex-col h-screen">
    {#each memebids as token, i (token)}
      <div class="flex-[0_0_100%] min-h-0">
        <TokenDetailCarousel focused={currentMemebidsIdx === i} id={i} />
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
