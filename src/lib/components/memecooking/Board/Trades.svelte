<script lang="ts">
  import { onMount } from "svelte";

  import Chef from "../Chef.svelte";

  import type { Trade } from "$lib/api/client";
  import { MCTradeSubscribe, MCunsubscribe } from "$lib/store/memebids";
  import { FixedNumber } from "$lib/util";
  import { predictedTokenAmount } from "$lib/util/predictedTokenAmount";
  import { timesAgo } from "$lib/util/timesAgo";

  export let trades: Array<Trade & { tokenAmount: number }>;
  export let meme_id: number;
  export let paginated = true;

  const MCsymbol = Symbol();

  let currentPage = 1;
  const itemsPerPage = 20;

  $: totalPages = Math.ceil(trades.length / itemsPerPage);

  $: displayedTrades = paginated
    ? trades.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : trades;

  function goToPage(page: number) {
    if (page < 1 || page > totalPages) return;
    currentPage = page;
  }

  onMount(() => {
    MCTradeSubscribe(MCsymbol, (newTrade) => {
      if (newTrade.meme_id !== meme_id) {
        return;
      }

      const tokenAmount = predictedTokenAmount({
        amount: newTrade.amount,
        total_deposit: newTrade.total_deposit,
        total_supply: newTrade.total_supply || undefined,
      });

      const newTradeWithTokenAmount = { ...newTrade, tokenAmount };

      trades = [newTradeWithTokenAmount, ...trades];
    });

    return () => {
      MCunsubscribe(MCsymbol);
    };
  });
</script>

{#each displayedTrades as trade (trade.receipt_id)}
  <li
    class="flex [&>*]:mx-[0.1rem] justify-between items-center p-2 bg-gray-600 rounded-lg text-white"
  >
    <span
      class="flex-[0.5_1_5rem] text-start flex items-center gap-1 overflow-hidden text-ellipsis"
    >
      <Chef
        account={trade.account_id}
        class="bg-shitzu-4 px-1 rounded text-black"
      />
    </span>
    <span class="flex-[0_0_3rem] text-start">
      <span class={trade.is_deposit ? "text-green-500" : "text-red-500"}>
        {trade.is_deposit ? "deposit" : "withdraw"}
      </span>
    </span>
    <span class="flex-[0.1_0_5rem] text-start">
      {new FixedNumber(trade.amount, 24).format()}
    </span>
    <span class="flex-[0.1_0_5rem] text-start">
      {timesAgo(new Date(trade.timestamp_ms))} ago
    </span>
    <a
      href="{import.meta.env.VITE_NEARBLOCKS_URL}/hash/{trade.receipt_id}"
      target="_blank"
      rel="noopener noreferrer"
      class="flex-[0.2_0_5rem] text-start hover:text-shitzu-4 hover:underline hover:font-bold overflow-hidden text-ellipsis"
    >
      {trade.receipt_id.slice(0, 4)}...{trade.receipt_id.slice(-4)}
    </a>
  </li>
{/each}

{#if paginated}
  <!-- Add pagination controls -->
  <div class="pagination-controls flex justify-between items-center mt-4">
    <button
      on:click={() => goToPage(currentPage - 1)}
      disabled={currentPage === 1}
    >
      Previous
    </button>
    <span>Page {currentPage} of {totalPages}</span>
    <button
      on:click={() => goToPage(currentPage + 1)}
      disabled={currentPage === totalPages}
    >
      Next
    </button>
  </div>
{/if}
