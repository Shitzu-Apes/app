<script lang="ts">
  import { writable } from "svelte/store";
  import { slide } from "svelte/transition";

  export let header: string;
  export let loading: boolean = false;

  let contentHeight = 0;
  let maxHeight$ = writable(0);
  $: {
    if (contentHeight > $maxHeight$) {
      $maxHeight$ = contentHeight;
    }
  }
</script>

<div class="flex flex-col text-white overflow-hidden">
  <h3 class="mx-5 my-2 pb-2 border-b-1 border-b-gray-3 text-5 font-bold">
    {header}
  </h3>
  {#if loading}
    <div class="spinner" transition:slide>
      <div class="i-svg-spinners:3-dots-bounce w-6 h-6 bg-gray-7" />
    </div>
  {:else}
    <div
      class="flex flex-col flex-1 overflow-x-hidden px-1 py-2 transition-[min-height_0.6s_ease-in-out]"
      transition:slide
      bind:clientHeight={contentHeight}
      style:min-height="{$maxHeight$}px"
    >
      <slot />
    </div>
  {/if}
</div>
