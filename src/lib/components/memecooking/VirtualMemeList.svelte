<script lang="ts">
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";
  import { createWindowVirtualizer } from "@tanstack/svelte-virtual";
  import { onMount } from "svelte";

  import type { Meme } from "$lib/api/client";
  import SHITZU_DETECTIVE from "$lib/assets/static/shitzu_detective.png";
  import MemePreview from "$lib/components/memecooking/Board/Desktop/MemePreview.svelte";
  import type { FixedNumber } from "$lib/util";

  export let items: Array<{
    meme: Meme;
    meme_id?: number;
    amount?: string;
    token_id?: string;
    claimAmount?: FixedNumber;
  }>;
  export let isOwnAccount: boolean = false;
  export let showCook: boolean = true;
  export let update: (
    outcome: FinalExecutionOutcome | FinalExecutionOutcome[] | undefined,
  ) => void;
  export let emptyMessage: string = "No Token Held";
  export let quickActionAmount: string | undefined = undefined;
  export let className: string = ""; // Additional classes for container

  let numLanes = 3; // Default for large screens
  let containerElement: HTMLDivElement;
  let measuredElements: HTMLDivElement[] = [];
  let resizeObserver: ResizeObserver;

  onMount(() => {
    updateLanes();

    // Create resize observer to monitor container size changes
    resizeObserver = new ResizeObserver(() => {
      updateLanes();
    });

    if (containerElement) {
      resizeObserver.observe(containerElement);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  });

  function updateLanes() {
    const width = containerElement?.clientWidth ?? window.innerWidth;
    let newNumLanes;

    if (width < 640) {
      newNumLanes = 1;
    } else if (width < 768) {
      newNumLanes = 2;
    } else if (width < 1024) {
      newNumLanes = 2;
    } else if (width < 1280) {
      newNumLanes = 3;
    } else if (width < 1536) {
      newNumLanes = 3;
    } else {
      newNumLanes = 4;
    }

    numLanes = newNumLanes;
  }

  $: virtualizer = createWindowVirtualizer<HTMLDivElement>({
    count: items.length,
    estimateSize: () => 200,
    overscan: 15,
    lanes: numLanes,
    gap: 8,
  });

  $: {
    $virtualizer.setOptions({
      count: items.length,
      lanes: numLanes,
    });
    // Re-measure elements when items change
    measuredElements.forEach((element) => {
      $virtualizer.measureElement(element);
    });
  }

  function measureElement(element: HTMLDivElement) {
    if (!measuredElements.includes(element)) {
      measuredElements.push(element);
    }
    $virtualizer.measureElement(element);
  }
</script>

<svelte:window on:resize={updateLanes} />

<div bind:this={containerElement} class="w-full">
  {#if items.length === 0}
    <div
      class="text-center text-lg text-white flex flex-col items-center justify-center gap-2 my-10"
    >
      <img src={SHITZU_DETECTIVE} class="w-40" alt="No memes found" />
      {emptyMessage}
    </div>
  {:else}
    <div class="my-6 w-full {className}">
      <div
        style="position: relative; height: {$virtualizer.getTotalSize()}px; width: 100%;"
      >
        {#each $virtualizer.getVirtualItems() as row ((row.index, items[row.index].meme.meme_id))}
          <div
            style="position: absolute; top: 0; left: {(row.lane / numLanes) *
              100}%; width: calc({100 / numLanes}% - {row.lane === numLanes - 1
              ? 0
              : 8}px); transform: translateY({row.start}px);"
            data-index={row.index}
            use:measureElement
          >
            <MemePreview
              memebid={items[row.index].meme}
              depositAmount={items[row.index].amount}
              claimAmount={items[row.index].claimAmount}
              {showCook}
              {isOwnAccount}
              {update}
              {quickActionAmount}
            />
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
