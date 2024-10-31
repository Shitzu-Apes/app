<script lang="ts">
  import { createWindowVirtualizer } from "@tanstack/svelte-virtual";
  import { onMount } from "svelte";

  import LoadingLambo from "../LoadingLambo.svelte";

  import MemePreview from "./MemePreview.svelte";
  import QuickActionConfig from "./QuickActionConfig.svelte";

  import SHITZU_DETECTIVE from "$lib/assets/static/shitzu_detective.png";
  import SelectBox from "$lib/components/SelectBox.svelte";
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
  let quickActionAmount = "5";

  $: displayedMemebids = $memebids$.then((memebids) => [
    ...filterAndSortMeme(
      memebids,
      {
        sort: selectedSort.value,
        order: selectedDirection.value,
      },
      $searchQuery$,
      activeTab === "auction" ? true : false,
      activeTab === "live",
    ),
  ]);

  let numLanes = 4; // Default for large screens

  onMount(() => {
    updateLanes();
  });

  function updateLanes() {
    // Get container width based on Tailwind container class
    // Container has different max-widths at different breakpoints
    const width = window.innerWidth;
    let containerWidth;

    if (width < 640) {
      // sm
      containerWidth = width - 32; // Default padding
    } else if (width < 768) {
      // md
      containerWidth = 640;
    } else if (width < 1024) {
      // lg
      containerWidth = 768;
    } else if (width < 1280) {
      // xl
      containerWidth = 1024;
    } else if (width < 1536) {
      // 2xl
      containerWidth = 1280;
    } else {
      containerWidth = 1536;
    }

    // Calculate number of lanes based on target element width of 400px
    // Account for 10px gap between elements
    numLanes = Math.max(1, Math.floor((containerWidth + 10) / (400 + 10)));
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

<div class="w-full">
  <div class=" flex gap-2 justify-center items-center">
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
      Live
    </button>
    <button
      class="px-4 py-2 rounded-lg {activeTab === 'live'
        ? 'bg-shitzu-3 text-black'
        : 'text-gray-400 hover:text-white'}"
      on:click={() => (activeTab = "live")}
    >
      Launched
    </button>
  </div>

  <div
    class="w-full flex flex-wrap justify-center sm:justify-start gap-3 mt-6 px-1"
  >
    <SelectBox options={sortOptions} bind:selected={selectedSort} />
    <SelectBox options={orderOptions} bind:selected={selectedDirection} />
    <QuickActionConfig bind:quickActionAmount />
  </div>

  {#await Promise.all([requiredStake, displayedMemebids])}
    <div class="w-full mt-10 mb-10">
      <LoadingLambo />
    </div>
  {:then [requiredStake, displayedMemebids]}
    <div class="mt-10 px-1 mb-10">
      {#if displayedMemebids.length === 0}
        <div
          class="text-center text-lg text-white flex flex-col items-center justify-center gap-2"
        >
          <img src={SHITZU_DETECTIVE} class="w-40" alt="No memes found" />
          No memes found
        </div>
      {/if}
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
              100}%; width: calc({100 / numLanes}% - {row.lane === numLanes - 1
              ? 0
              : 10}px); transform: translateY({row.start}px);"
            data-index={row.index}
            use:measureElement
          >
            <MemePreview
              memebid={displayedMemebids[row.index]}
              {requiredStake}
              {quickActionAmount}
            />
          </div>
        {/each}
      </div>
    </div>
  {/await}
</div>

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
