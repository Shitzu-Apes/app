<script lang="ts">
  import { createEventDispatcher } from "svelte";

  import BuyNftBanner from "../Banner/BuyNFTBanner.svelte";
  import Squircle from "../Squircle.svelte";

  import type { FixedNumber } from "$lib/util";

  export let rankingEntries: Array<{
    token_id: string;
    account_id: string;
    score: FixedNumber;
    rank: number;
  }> = [];

  export let currentPage = 0;
  export let totalPages = 1;

  const BASE_URL = import.meta.env.VITE_NFT_BASE_URL;

  function onPageFirst() {
    dispatch("page", 0);
  }

  function onPagePrevious() {
    if (currentPage > 0) {
      dispatch("page", currentPage - 1);
    }
  }

  function onPageNext() {
    if (currentPage < totalPages - 1) {
      dispatch("page", currentPage + 1);
    }
  }

  function onPageLast() {
    dispatch("page", totalPages - 1);
  }

  const dispatch = createEventDispatcher<{
    page: number;
  }>();
</script>

{#if rankingEntries.length > 0}
  <ol
    class="mt-5 flex flex-col border-2 border-lime rounded-xl bg-black overflow-hidden"
  >
    <div
      class="relative w-full flex items-center bg-gradient-to-r bg-gradient-from-lime bg-gradient-to-emerald border-b-2 border-lime w-full py-3 px-2 gap-6"
    >
      <BuyNftBanner variant="small" />
    </div>

    {#each rankingEntries as { token_id, account_id, score, rank } (token_id)}
      <li
        class="flex justify-center items-center text-white py-3 px-3 border-b first:border-t border-lime last:border-none {account_id ===
        'You'
          ? 'bg-lime/50'
          : ''}"
      >
        <a href="/shitstars/{token_id}" class="mr-3">
          <Squircle class="size-18 text-lime" src="{BASE_URL}/{token_id}.png" />
        </a>

        <div class="max-w-[200px]">
          <div class="font-light text-lg text-ellipsis overflow-hidden">
            {account_id}
          </div>
          <div class="font-bold text-base flex items-center">
            <div class="i-mdi:stars size-5 mr-1" />
            {score.format()}
          </div>
        </div>

        <div
          class="ml-auto text-2xl flex justify-center items-center bg-lime size-6 text-black rounded-full text-xs font-bold"
        >
          {rank}
        </div>
      </li>
    {/each}
  </ol>

  <!-- Pagination -->
  <div class="flex justify-between px-1 py-4">
    <div>
      <button on:click={onPageFirst}>
        <div class="i-mdi:chevron-double-left size-6" />
      </button>
      <button on:click={onPagePrevious}>
        <div class="i-mdi:chevron-left size-6" />
      </button>
    </div>
    <div>
      {currentPage + 1} / {totalPages}
    </div>
    <div>
      <button on:click={onPageNext}>
        <div class="i-mdi:chevron-right size-6" />
      </button>
      <button class="ml-3" on:click={onPageLast}>
        <div class="i-mdi:chevron-double-right size-6" />
      </button>
    </div>
  </div>
{/if}
