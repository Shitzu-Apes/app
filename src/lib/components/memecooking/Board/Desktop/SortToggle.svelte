<script lang="ts">
  import { orderOptions } from "$lib/util/sortMeme";

  export let selectedDirection = orderOptions[0];
</script>

<button
  class="size-8 rounded-full border border-gray-700 hover:border-gray-600 transition-colors bg-gray-800 flex items-center justify-center"
  on:click={() => {
    const currentIndex = orderOptions.indexOf(selectedDirection);
    selectedDirection = orderOptions[(currentIndex + 1) % orderOptions.length];
  }}
>
  {#if selectedDirection.value === "asc"}
    <div class="i-mdi:sort-ascending size-4" />
  {:else}
    <div class="i-mdi:sort-descending size-4" />
  {/if}
</button>
