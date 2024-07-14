<script lang="ts">
  import MemePreview from "./MemePreview.svelte";

  import SelectBox from "$lib/components/SelectBox.svelte";
  import type { MCMemeInfoWithReference } from "$lib/models/memecooking";
  import { orderOptions, sortMeme, sortOptions } from "$lib/util/sortMeme";

  let selectedSort = sortOptions[0];

  let selectedDirection = orderOptions[0];

  export let memebids: MCMemeInfoWithReference[];

  $: memebids = sortMeme(memebids, {
    sort: selectedSort.value,
    order: selectedDirection.value,
  });
</script>

<div class="flex gap-3 mt-6 px-4">
  <SelectBox options={sortOptions} bind:selected={selectedSort} />
  <SelectBox options={orderOptions} bind:selected={selectedDirection} />
</div>

<div
  class="w-full flex items-center justify-start flex-wrap mt-10 gap-6 px-4 mb-10"
>
  {#each memebids as memebid (memebid.id)}
    <MemePreview {memebid} />
  {/each}
</div>
