<script lang="ts">
  import { fly } from "svelte/transition";

  import MemePreview from "./MemePreview.svelte";

  import SelectBox from "$lib/components/SelectBox.svelte";
  import Toggle from "$lib/components/Toggle.svelte";
  import { requiredStake } from "$lib/near";
  import { memebids$, searchQuery$ } from "$lib/store/memebids";
  import {
    orderOptions,
    filterAndSortMeme,
    sortOptions,
  } from "$lib/util/sortMeme";

  let selectedSort = sortOptions[0];

  let selectedDirection = orderOptions[0];

  let liveOnly = false;

  $: displayedMemebids = $memebids$.then((memebids) => [
    ...filterAndSortMeme(
      memebids,
      {
        sort: selectedSort.value,
        order: selectedDirection.value,
      },
      $searchQuery$,
      liveOnly,
    ),
  ]);

  let page = 1;
  let perPage = 21;
</script>

<div class="flex gap-3 mt-6 px-4">
  <SelectBox options={sortOptions} bind:selected={selectedSort} />
  <SelectBox options={orderOptions} bind:selected={selectedDirection} />
  <Toggle bind:isOn={liveOnly}>live only:{" "}</Toggle>
</div>

{#await Promise.all([requiredStake, displayedMemebids])}
  <div
    class="w-full flex items-center justify-around flex-wrap mt-10 gap-6 px-4 mb-10"
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
  <div
    class="w-full flex items-center justify-around flex-wrap mt-10 gap-6 px-4 mb-10"
  >
    {#if displayedMemebids[0]}
      {#key displayedMemebids[0].meme_id}
        <div
          class="flex-grow basis-[30%] min-w-[300px] max-w-[30%] border-3 border-transparent animate-shake-and-border"
        >
          <MemePreview memebid={displayedMemebids[0]} {requiredStake} />
        </div>
      {/key}
    {/if}
    {#each displayedMemebids.slice(1 + (page - 1) * perPage, page * perPage) as memebid (memebid.meme_id)}
      <div class="flex-grow basis-[30%] min-w-[300px] max-w-[30%]" in:fly>
        <MemePreview {memebid} {requiredStake} />
      </div>
    {/each}
    <div class="flex items-center justify-center w-full gap-10">
      <button
        on:click={() => {
          page = Math.max(1, page - 1);
        }}
      >
        prev
      </button>
      <button
        on:click={() => {
          page = Math.min(
            page + 1,
            Math.ceil(displayedMemebids.length / perPage),
          );
        }}
      >
        next
      </button>
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
    animation: shakeAndBorder 500ms;
    animation-iteration-count: 3;
  }
</style>
