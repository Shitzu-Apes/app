<script lang="ts">
  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";
  import SelectBox from "$lib/components/SelectBox.svelte";
  import type { MCMemeInfoWithReference } from "$lib/models/memecooking";

  let sortOptions = [
    { label: "sort: bump order", value: "bump order" },
    { label: "sort: market cap", value: "market cap" },
    { label: "sort: creation time", value: "creation time" },
    { label: "sort: live", value: "live" },
  ];

  let selectedSort = sortOptions[0];

  let orderOptions = [
    { label: "order: asc", value: "asc" },
    { label: "order: desc", value: "desc" },
  ];

  let selectedDirection = orderOptions[0];

  export let memebids: MCMemeInfoWithReference[];
</script>

<div class="flex gap-3 mt-6 px-4">
  <SelectBox options={sortOptions} bind:selected={selectedSort} />
  <SelectBox options={orderOptions} bind:selected={selectedDirection} />
</div>

<div
  class="w-full flex items-center justify-between flex-wrap mt-10 gap-6 px-4 mb-10"
>
  {#each memebids as memebid}
    <a
      href="/meme/{memebid.id}"
      class="flex items-start justify-start w-full max-w-sm gap-3 p-2 border border-transparent hover:border-white cursor-pointer"
    >
      <img src={memebid.image} alt={memebid.name} class="w-24 h-24" />
      <div class="flex flex-col items-start justify-start h-full gap-1">
        <div class="text-xs flex items-center gap-1">
          created by <img
            src={SHITZU_POCKET}
            alt="shitzu pocket"
            class="size-4"
          />
          {memebid.owner}
        </div>
        <div class="text-sm">
          {memebid.name}
          <span class="font-bold text-shitzu-4">${memebid.symbol}</span>
        </div>
        <div class="text-xs">{memebid.description}</div>
      </div>
    </a>
  {/each}
</div>
