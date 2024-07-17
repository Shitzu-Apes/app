<script lang="ts">
  import MemePreview from "./MemePreview.svelte";

  import SelectBox from "$lib/components/SelectBox.svelte";
  import type { MCMemeInfoWithReference } from "$lib/models/memecooking";
  import { orderOptions, sortMeme, sortOptions } from "$lib/util/sortMeme";

  let selectedSort = sortOptions[0];

  let selectedDirection = orderOptions[0];

  export let memebids: MCMemeInfoWithReference[];

  export let initialMemebidsPromise: Promise<void>;

  $: memebids = sortMeme(memebids, {
    sort: selectedSort.value,
    order: selectedDirection.value,
  });
</script>

<div class="flex gap-3 mt-6 px-4">
  <SelectBox options={sortOptions} bind:selected={selectedSort} />
  <SelectBox options={orderOptions} bind:selected={selectedDirection} />
</div>

{#await initialMemebidsPromise}
  <div
    class="w-full flex items-center justify-start flex-wrap mt-10 gap-6 px-4 mb-10"
  >
    <div
      class="flex items-start justify-start w-full max-w-sm gap-3 p-2 border border-transparent hover:border-white cursor-pointer"
    >
      <div class="w-24 h-24 loader"></div>
      <div class="flex flex-col items-start justify-start h-full gap-1">
        <div class="text-xs flex items-center gap-1">
          created by <div class="size-4 loader"></div>
        </div>
        <div class="text-sm">
          Meme Name
          <span class="font-bold text-shitzu-4">$SYMBOL</span>
        </div>
        <div class="text-xs">Description of the meme</div>

        <div class="flex flex-col gap-1">
          <span class="text-xs text-shitzu-4">
            <div class="text-xs text-shitzu-4 loader w-full h-4"></div>
          </span>
          <span
            class="text-xs loader text-black px-2 rounded self-start flex items-center"
          >
            <div class="size-4 -ml-1 loader"></div>
          </span>
        </div>
      </div>
    </div>
  </div>
{:then}
  <div
    class="w-full flex items-center justify-start flex-wrap mt-10 gap-6 px-4 mb-10"
  >
    {#each memebids as memebid (memebid.id)}
      <MemePreview {memebid} />
    {/each}
  </div>
{/await}
