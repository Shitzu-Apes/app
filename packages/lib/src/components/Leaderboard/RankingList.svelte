<script lang="ts">
  import { createEventDispatcher } from "svelte";

  import BuyNftBanner from "../Banner/BuyNFTBanner.svelte";

  import RankingItem from "./RankingItem.svelte";

  import type { FixedNumber } from "$lib/util";

  export let rankingEntries: Array<{
    token_id: string;
    account_id: string | null;
    score: FixedNumber;
    rank: number;
  }> = [];

  export let currentPage = 0;
  export let totalPages = 1;

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
      <RankingItem
        {token_id}
        initial_account_id={account_id}
        {score}
        {rank}
        isCurrentUser={account_id === "You"}
      />
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
