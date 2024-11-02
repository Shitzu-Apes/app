<script lang="ts">
  import { onMount } from "svelte";

  import Trade from "./Trade.svelte";

  import type { Trade as TTrade } from "$lib/api/client";
  import { MCTradeSubscribe, MCunsubscribe } from "$lib/store/MCWebSocket";
  import { predictedTokenAmount } from "$lib/util/predictedTokenAmount";

  export let trades: Array<TTrade & { tokenAmount: number }>;
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
  <Trade {trade} />
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
