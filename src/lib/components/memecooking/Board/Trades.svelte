<script lang="ts">
  import { onMount } from "svelte";
  import { fly } from "svelte/transition";

  import Chef from "../Chef.svelte";

  import type { Trade } from "$lib/api/client";
  import { MCTradeSubscribe, MCunsubscribe } from "$lib/store/memebids";
  import { FixedNumber } from "$lib/util";
  import { predictedTokenAmount } from "$lib/util/predictedTokenAmount";
  import { timesAgo } from "$lib/util/timesAgo";

  export let trades: Array<Trade & { tokenAmount: number }>;
  export let meme_id: number;

  const MCsymbol = Symbol();

  const txIdCache: Record<string, string | null> = {};
  async function fetchTxIdViaReceiptId(
    receiptId: string,
  ): Promise<string | null | undefined> {
    if (txIdCache[receiptId] !== undefined) {
      return txIdCache[receiptId];
    }
    try {
      const res = await fetch(
        `https://api3-testnet.nearblocks.io/v1/search/?keyword=${receiptId}`,
      );

      const json = await res.json();
      const txId = json.receipts[0].originated_from_transaction_hash;
      txIdCache[receiptId] = txId;
      return txId;
    } catch (err) {
      console.error(err);
      txIdCache[receiptId] = null;
    }
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

{#each trades as trade (trade.receipt_id)}
  <li
    class="flex [&>*]:mx-[0.1rem] justify-between items-center p-2 bg-gray-600 rounded-lg text-white"
    in:fly={{ x: "-100%" }}
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
        {trade.is_deposit ? "stake" : "unstake"}
      </span>
    </span>
    <span class="flex-[0.1_0_5rem] text-start">
      {new FixedNumber(trade.amount, 24).format()}
    </span>
    <span class="flex-[0.1_0_5rem] text-start">
      {timesAgo(new Date(trade.timestamp_ms))} ago
    </span>
    {#await fetchTxIdViaReceiptId(trade.receipt_id) then txId}
      {#if txId != null}
        <a
          href="{import.meta.env.VITE_EXPLORER_URL}/transactions/{txId}"
          target="_blank"
          rel="noopener noreferrer"
          class="flex-[0.2_0_5rem] text-start hover:text-shitzu-4 hover:underline hover:font-bold overflow-hidden text-ellipsis"
        >
          {txId.slice(0, 4)}...{txId.slice(-4)}
        </a>
      {:else}
        <span class="flex-[0.2_0_5rem]">-</span>
      {/if}
    {/await}
  </li>
{/each}
