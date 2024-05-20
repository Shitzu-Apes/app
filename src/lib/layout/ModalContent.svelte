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

<div class="modal">
  <h3 class="header">{header}</h3>
  {#if loading}
    <div class="spinner" transition:slide>
      <div class="i-svg-spinners:3-dots-bounce w-6 h-6 bg-gray-7" />
    </div>
  {:else}
    <div
      class="content"
      transition:slide
      bind:clientHeight={contentHeight}
      style:min-height="{$maxHeight$}px"
    >
      <slot />
    </div>
  {/if}
</div>

<style lang="scss">
  .modal {
    display: flex;
    flex-direction: column;
    color: white;
    overflow: hidden;
  }

  .header {
    margin: 0.4rem 0 1.2rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid lightgray;
  }

  .content {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    transition: min-height 0.6s ease-in-out;
    overflow: hidden auto;
    padding: 0.6rem 0.2rem;
  }
</style>
