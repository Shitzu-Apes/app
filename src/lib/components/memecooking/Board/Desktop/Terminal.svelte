<script lang="ts">
  import { createWindowVirtualizer } from "@tanstack/svelte-virtual";
  import { onMount } from "svelte";

  import MemePreview from "./MemePreview.svelte";

  import SelectBox from "$lib/components/SelectBox.svelte";
  import Toggle from "$lib/components/Toggle.svelte";
  import { requiredStake } from "$lib/near/memecooking";
  import { memebids$, searchQuery$ } from "$lib/store/memebids";
  import {
    orderOptions,
    filterAndSortMeme,
    sortOptions,
  } from "$lib/util/sortMeme";

  let selectedSort = sortOptions[0];
  let selectedDirection = orderOptions[0];
  let activeTab: "auction" | "live" | "all" = "all";
  let liveOnly = true;

  $: displayedMemebids = $memebids$.then((memebids) => [
    ...filterAndSortMeme(
      memebids,
      {
        sort: selectedSort.value,
        order: selectedDirection.value,
      },
      $searchQuery$,
      activeTab === "auction" ? liveOnly : false,
      activeTab === "live",
    ),
  ]);

  let numLanes = 4; // Default for large screens

  onMount(() => {
    updateLanes();
  });

  function updateLanes() {
    const width = window.innerWidth;
    if (width < 640) {
      // sm breakpoint
      numLanes = 1;
    } else if (width < 1024) {
      // lg breakpoint
      numLanes = 2;
    } else if (width < 1280) {
      numLanes = 3;
    } else {
      numLanes = 4;
    }
  }

  $: virtualizer = createWindowVirtualizer<HTMLDivElement>({
    count: 200,
    initialOffset: 300,
    estimateSize: () => 600, // Approximate height of MemePreview
    overscan: 15,
    lanes: numLanes,
    gap: 10,
  });

  $: {
    displayedMemebids.then((data) => {
      $virtualizer.setOptions({
        count: data.length,
        lanes: numLanes,
      });
    });
  }

  function measureElement(element: HTMLDivElement) {
    $virtualizer.measureElement(element);
  }
</script>

<svelte:window on:resize={updateLanes} />

<div class="w-full flex gap-2 justify-center items-center">
  <button
    class="px-4 py-2 rounded-lg {activeTab === 'all'
      ? 'bg-shitzu-3 text-black'
      : 'text-gray-400 hover:text-white'}"
    on:click={() => (activeTab = "all")}
  >
    All
  </button>
  <button
    class="px-4 py-2 rounded-lg {activeTab === 'auction'
      ? 'bg-shitzu-3 text-black'
      : 'text-gray-400 hover:text-white'}"
    on:click={() => (activeTab = "auction")}
  >
    Auction
  </button>
  <button
    class="px-4 py-2 rounded-lg {activeTab === 'live'
      ? 'bg-shitzu-3 text-black'
      : 'text-gray-400 hover:text-white'}"
    on:click={() => (activeTab = "live")}
  >
    Live
  </button>
</div>

<div class="flex flex-wrap gap-3 mt-6 px-4">
  <SelectBox options={sortOptions} bind:selected={selectedSort} />
  <SelectBox options={orderOptions} bind:selected={selectedDirection} />
  {#if activeTab === "auction"}
    <Toggle bind:isOn={liveOnly}>live auction:{" "}</Toggle>
  {/if}
</div>

{#await Promise.all([requiredStake, displayedMemebids])}
  <div
    class="w-full flex items-center justify-around flex-wrap mt-10 gap-6 px-5 mb-10"
  >
    <!-- eslint-disable-next-line -->
    {#each { length: 10 } as _, i (i)}
      <div
        class="flex items-start justify-start w-full max-w-sm gap-3 p-2 border border-transparent hover:border-white cursor-pointer"
      >
        <div class="w-24 h-24 loader"></div>
        <div class="flex flex-col items-start justify-start h-full gap-1">
          <div class="text-xs flex items-center gap-1 loader w-42 h-4"></div>
          <div class="text-sm w-24 h-4 loader"></div>
          <div class="text-xs w-24 h-4 loader"></div>

          <div class="flex flex-col gap-1">
            <span class="text-xs text-shitzu-4">
              <div class="text-xs text-shitzu-4 loader w-14 h-4"></div>
            </span>
            <span class="loader w-10 h-4"></span>
          </div>
        </div>
      </div>
    {/each}
  </div>
{:then [requiredStake, displayedMemebids]}
  <div class="mt-10 px-1 sm:px-5 mb-10">
    <div
      style="position: relative; height: {$virtualizer.getTotalSize()}px; width: 100%;"
    >
      {#each $virtualizer.getVirtualItems() as row (row.index)}
        <div
          class="w-full sm:w-[calc(33.333%-16px)] lg:w-[calc(25%-18px)] {row.index ===
          0
            ? 'animate-shake-and-border border-3 border-transparent'
            : ''}"
          style="position: absolute; top: 0; left: {(row.lane / numLanes) *
            100}%; width: calc({100 / numLanes}% - {numLanes === 1
            ? 0
            : 10}px); transform: translateY({row.start}px);"
          data-index={row.index}
          use:measureElement
        >
          <MemePreview memebid={displayedMemebids[row.index]} {requiredStake} />
        </div>
      {/each}
    </div>
  </div>
{/await}

<style>
  @keyframes shakeAndBorder {
    0% {
      transform: translateX(0);
      border-color: transparent;
    }
    25% {
      transform: translateX(-15px);
      border-color: yellow;
    }
    50% {
      transform: translateX(15px);
      border-color: yellow;
    }
    75% {
      transform: translateX(-15px);
      border-color: yellow;
    }
    100% {
      transform: translateX(0);
      border-color: transparent;
    }
  }

  .animate-shake-and-border {
    animation: shakeAndBorder 300ms;
    animation-iteration-count: 2;
  }
</style>
