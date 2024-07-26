<script lang="ts">
  import {
    type EmblaCarouselType,
    type EmblaOptionsType,
  } from "embla-carousel";
  import embalaCarousel from "embla-carousel-svelte";

  import StakeSheet from "../BottomSheet/StakeSheet.svelte";
  import TokenCommentSheet from "../BottomSheet/TokenCommentSheet.svelte";

  import TokenChart from "./TokenChart.svelte";
  import TokenDetail from "./TokenDetail.svelte";
  import TokenHolder from "./TokenHolder.svelte";
  import TokenTrade from "./TokenTrade.svelte";

  import { goto } from "$app/navigation";
  import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
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

<div class="relative h-[calc(100dvh-200px)]">
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
          <TokenChart {memebid} touchToStart />
        {/if}
      </div>
      <div class="flex-[0_0_100%] min-w-0">
        <TokenTrade
          meme_id={memebid.meme_id}
          symbol={memebid.symbol}
          trades={Promise.resolve([])}
        />
      </div>
      <div class="flex-[0_0_100%] min-w-0">
        <TokenHolder meme={memebid} />
      </div>
    </div>
  </div>
  <div class="absolute right-0 bottom-0 p-2 mb-5 flex bg-black/25 rounded-t">
    <ul class="flex flex-col items-end gap-3">
      <li>
        <button
          on:click={() => {
            openBottomSheet(TokenCommentSheet, { id });
          }}
        >
          [discuss]
        </button>
      </li>
      <li>[share]</li>
    </ul>
  </div>
</div>
<div
  class="w-full h-8 flex justify-evenly border-b bg-shitzu-4 text-black items-center"
>
  {#each ["[detail]", "[chart]", "[trade]", "[holder]"] as tab, i (tab)}
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
  class="h-[168px] w-full flex flex-col justify-center items-center pb-2 px-2"
>
  {#if memebid.end_timestamp_ms && memebid.end_timestamp_ms < Date.now()}
    <button
      class="border-2 border-black font-mono bg-memecooking-5 px-2 rounded text-black hover:bg-memecooking-6 flex items-center gap-2"
      on:click={(e) => {
        e.preventDefault();
        goto(`/create`);

        localStorage.setItem("meme_to_cto", JSON.stringify(memebid));
      }}
    >
      <div class="i-mdi:alert" />
      Gud meme, Let's CTO
    </button>
  {/if}
  <button
    on:click={() => {
      openBottomSheet(StakeSheet, { meme: memebid });
    }}
    class="bg-shitzu-3 w-full py-2 rounded-full text-xl tracking-wider text-black border-b-4 border-shitzu-4 active:translate-y-1"
  >
    [stake]
  </button>
</div>
