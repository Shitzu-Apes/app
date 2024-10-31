<script lang="ts">
  import Trades from "./Trades.svelte";

  import type { paths } from "$lib/api/openapi";

  export let meme_id: number;
  export let trades: Promise<
    Array<
      paths["/trades"]["get"]["responses"]["200"]["content"]["application/json"][number] & {
        tokenAmount: number;
      }
    >
  >;
  export let touchToStart = false;
  export let paginated = true;
  let isInteracted = false || !touchToStart;
</script>

<div class="relative w-full h-full max-h-[25rem] sm:max-h-unset overflow-auto">
  <button
    class="flex w-full overflow-x-auto h-full relative"
    on:click|stopPropagation
    on:mousedown|stopPropagation
    on:touchstart|stopPropagation
    on:pointerdown|stopPropagation
  >
    <ul class="w-full flex flex-col gap-1 text-xs min-w-[500px]">
      <li
        class="flex [&>*]:mx-[0.1rem] justify-between items-center p-2 bg-gray-600 rounded-lg text-white"
      >
        <span class="flex-[0.5_1_5rem] text-start">account</span>
        <span class="flex-[0_0_3rem] text-start">type</span>
        <span class="flex-[0.1_0_5rem] text-start">NEAR</span>
        <span class="flex-[0.1_0_5rem] text-start">date</span>
        <span class="flex-[0.2_0_5rem] text-start">transaction</span>
      </li>
      {#await trades}
        <li
          class="flex justify-between items-center p-2 bg-gray-600 rounded-lg text-white loader h-8"
        ></li>
      {:then trades}
        {#if trades.length > 0}
          <Trades {trades} {meme_id} {paginated} />
        {:else}
          <div
            class="flex justify-center items-center p-2 bg-gray-600 rounded-lg text-white"
          >
            No trades found
          </div>
        {/if}
      {/await}
    </ul>
  </button>

  {#if !isInteracted}
    <button
      class="absolute inset-0 flex items-center justify-center bg-shitzu-4/25"
      on:click={() => {
        isInteracted = true;
      }}
    >
      <div class="text-white text-2xl flex flex-col items-center gap-4">
        <div class="i-mdi:fingerprint size-24" />
        Tap to start explore the trades
      </div>
    </button>
  {/if}
</div>
