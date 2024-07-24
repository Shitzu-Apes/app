<script lang="ts">
  import { onMount } from "svelte";

  import Chef from "../Chef.svelte";

  import type { Trade } from "$lib/api/client";
  import { MCsubscribe } from "$lib/store/memebids";
  import { FixedNumber } from "$lib/util";
  import { timesAgo } from "$lib/util/timesAgo";

  export let trades: Array<Trade & { tokenAmount: number }>;
  export let meme_id: number;

  const MCsymbol = Symbol();

  onMount(() => {
    MCsubscribe(MCsymbol, (newTrade) => {
      if (newTrade.meme_id === meme_id) {
        return;
      }

      const tokenAmount =
        (new FixedNumber(newTrade.amount, 24).toNumber() /
          new FixedNumber(newTrade.total_deposit, 24).toNumber()) *
        500_000_000;
      trades = [{ ...newTrade, tokenAmount }, ...trades];
    });
  });
</script>

{#each trades as trade}
  <li
    class="flex justify-between items-center p-2 bg-gray-600 rounded-lg text-white"
  >
    <span
      class="w-1/5 text-start flex items-center gap-1 overflow-hidden text-ellipsis"
    >
      <Chef
        account={trade.account_id}
        class="bg-shitzu-4 px-1 rounded text-black"
      />
    </span>
    <span class="w-1/5 text-start">
      <span class={trade.is_deposit ? "text-green-500" : "text-red-500"}>
        {trade.is_deposit ? "buy" : "sell"}
      </span>
    </span>
    <span class="w-1/5 text-start"
      >{new FixedNumber(trade.amount, 24).format()}</span
    >
    <span class="w-1/5 text-start"
      >{new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        notation: "compact",
      }).format(trade.tokenAmount)}</span
    >
    <span class="w-1/5 text-start"
      >{timesAgo(new Date(trade.timestamp_ms))} ago</span
    >
    <a
      href={`https://nearblocks.io/tx/${trade.meme_id}`}
      target="_blank"
      rel="noopener noreferrer"
      class="w-1/5 text-start hover:text-shitzu-4 hover:underline overflow-hidden text-ellipsis"
      >{trade.receipt_id.slice(0, 4)}...{trade.receipt_id.slice(-4)}</a
    >
  </li>
{/each}
