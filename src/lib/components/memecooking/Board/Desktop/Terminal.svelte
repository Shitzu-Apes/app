<script lang="ts">
  import MemePreview from "./MemePreview.svelte";

  import SelectBox from "$lib/components/SelectBox.svelte";
  import Toggle from "$lib/components/Toggle.svelte";
  import type { MCMemeInfoWithReference } from "$lib/models/memecooking";
  import {
    orderOptions,
    filterAndSortMeme,
    sortOptions,
  } from "$lib/util/sortMeme";

  let selectedSort = sortOptions[0];

  let selectedDirection = orderOptions[0];

  export let memebids: MCMemeInfoWithReference[];

  export let initialMemebidsPromise: Promise<void>;

  let liveOnly = false;

  $: displayedMemebids = filterAndSortMeme(
    memebids,
    {
      sort: selectedSort.value,
      order: selectedDirection.value,
    },
    liveOnly,
  );
</script>

<div class="flex gap-3 mt-6 px-4">
  <SelectBox options={sortOptions} bind:selected={selectedSort} />
  <SelectBox options={orderOptions} bind:selected={selectedDirection} />
  <Toggle bind:isOn={liveOnly}>live only:{" "}</Toggle>
</div>

{#await initialMemebidsPromise}
  <div
    class="w-full flex items-center justify-start flex-wrap mt-10 gap-6 px-4 mb-10"
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
{:then}
  <div
    class="w-full flex items-center justify-start flex-wrap mt-10 gap-6 px-4 mb-10"
  >
    {#each displayedMemebids as memebid (memebid.meme_id)}
      <div class="flex-grow basis-[30%] min-w-[300px] max-w-[30%]">
        <MemePreview {memebid} />
      </div>
    {/each}
  </div>
{/await}
