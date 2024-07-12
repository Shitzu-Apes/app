<script lang="ts">
  import {
    type EmblaCarouselType,
    type EmblaOptionsType,
  } from "embla-carousel";
  import embalaCarousel from "embla-carousel-svelte";

  import MCStake from "./MCStake.svelte";
  import TokenChart from "./TokenChart.svelte";
  import TokenComment from "./TokenComment.svelte";
  import TokenDetail from "./TokenDetail.svelte";
  import TokenHolder from "./TokenHolder.svelte";

  import type { MCMemeInfoWithReference } from "$lib/models/memecooking";

  export let memebid: MCMemeInfoWithReference;

  let emblaApi: EmblaCarouselType | undefined = undefined;
  let options: EmblaOptionsType = {
    axis: "x",
    loop: true,
  };

  // just a placeholder for testing comment widget
  export let id: number;
  let selected = 0;

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

<svelte:window
  on:keydown={(event) => {
    if (focused) {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        prev();
      }
    }
  }}
/>

<div class="relative h-[70%]">
  <div
    class="overflow-hidden h-full relative"
    use:embalaCarousel={{ options, plugins: [] }}
    on:emblaInit={(event) => {
      emblaApi = event.detail;

      emblaApi.on("select", () => {
        if (emblaApi) {
          selected = emblaApi.selectedScrollSnap();
        }
      });
    }}
  >
    <div class="flex w-full h-full">
      <div
        class="flex-[0_0_100%] min-w-0 flex flex-col justify-center items-center h-full text-shitzu-4 gap-4"
      >
        <TokenDetail {memebid} />
      </div>
      <div class="flex-[0_0_100%] min-w-0">
        {#if focused && renderChart}
          <TokenChart {memebid} />
        {/if}
      </div>
      <div class="flex-[0_0_100%] min-w-0">
        <TokenHolder memeId={memebid.id} />
      </div>
      <div class="flex-[0_0_100%] min-w-0">
        <TokenComment {id} />
      </div>
    </div>
  </div>
  <div class="absolute right-0 bottom-0 p-2 mb-6 flex">
    <ul class="flex flex-col items-end gap-3">
      <li>[discuss]</li>
      <li>[share]</li>
    </ul>
  </div>
</div>
<div
  class="w-full h-8 flex justify-evenly border-b bg-shitzu-4 text-black items-center"
>
  {#each ["[detail]", "[chart]", "[holder]", "[discuss]"] as tab, i (tab)}
    <button
      class="cursor-pointer border-r border-dark w-[33%] last:border-transparent"
      class:font-bold={selected === i}
      on:click={() => {
        emblaApi?.scrollTo(i);
      }}
    >
      {tab}
    </button>
  {/each}
</div>

<div
  class="h-[calc(30%-32px)] w-full flex justify-center items-center pb-2 px-2"
>
  <MCStake meme_id={memebid.id} />
</div>
