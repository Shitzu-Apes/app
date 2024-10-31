<script lang="ts">
  import type { Writable } from "svelte/store";

  import StakeSheet from "../BottomSheet/StakeSheet.svelte";
  import TokenCommentSheet from "../BottomSheet/TokenCommentSheet.svelte";

  import ActionButtons from "./ActionButtons.svelte";
  import TokenChart from "./TokenChart.svelte";
  import TokenDetail from "./TokenDetail.svelte";
  import TokenHolder from "./TokenHolder.svelte";
  import TokenTrade from "./TokenTrade.svelte";

  import { goto } from "$app/navigation";
  import { client } from "$lib/api/client";
  import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { predictedTokenAmount } from "$lib/util/predictedTokenAmount";

  export let memebid$: Writable<Meme>;

  const trades = client
    .GET("/trades", {
      params: {
        query: {
          meme_id: $memebid$.meme_id.toString(),
        },
      },
    })
    .then((trade) => {
      console.log("[trade]", trade);
      if (!trade.data) return [];

      const trades = trade.data.map((trade) => ({
        ...trade,
        tokenAmount: predictedTokenAmount({ ...trade, ...$memebid$ }),
      }));

      return trades.sort((a, b) => b.timestamp_ms - a.timestamp_ms);
    });
</script>

<div class="flex-[1_1_0] flex flex-col items-stretch pb-30">
  <div class="flex mb-5 justify-between w-full px-2">
    <a href="/board" class="text-white flex items-center hover:text-shitzu-3">
      <div class="i-mdi:chevron-left size-8" />
      Back
    </a>
    <ActionButtons meme={$memebid$} />
  </div>

  <!-- Main Content -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 px-2">
    <!-- Left Column - Chart & Trading -->
    <div class="lg:col-span-2">
      <div class="bg-gray-800 rounded-lg p-2 mb-6 aspect-ratio-3/4">
        <TokenChart memebid={$memebid$} />
      </div>

      <div class="bg-gray-800 rounded-lg p-4">
        <TokenTrade memebid={$memebid$} {trades} paginated={false} />
      </div>
    </div>

    <!-- Right Column - Info -->
    <div class="space-y-6">
      <!-- Token Details -->
      <div class="bg-gray-800 rounded-lg p-4">
        <TokenDetail memebid={$memebid$} />
      </div>

      <!-- Token Holders -->
      <div class="bg-gray-800 rounded-lg p-4">
        <TokenHolder meme={$memebid$} />
      </div>
    </div>
  </div>

  <!-- Fixed Bottom Action Area -->
  <div
    class="fixed bottom-0 left-0 right-0 bg-dark border-t border-gray-800 p-4 lg:hidden z-20"
  >
    <div class="flex gap-2">
      <button
        on:click={(e) => {
          e.preventDefault();
          if (
            !$memebid$.pool_id &&
            $memebid$.end_timestamp_ms &&
            $memebid$.end_timestamp_ms < Date.now()
          ) {
            goto(`/create`);
            localStorage.setItem("meme_to_cto", JSON.stringify($memebid$));
          } else {
            openBottomSheet(StakeSheet, { meme: $memebid$ });
          }
        }}
        class="{!$memebid$.pool_id &&
        $memebid$.end_timestamp_ms &&
        $memebid$.end_timestamp_ms < Date.now()
          ? 'bg-memecooking-5 border-memecooking-6'
          : 'bg-shitzu-4 border-shitzu-6'} flex-1 py-2 rounded text-xl tracking-wider text-black"
      >
        {#if $memebid$.pool_id}
          [buy]
        {:else if $memebid$.end_timestamp_ms && $memebid$.end_timestamp_ms < Date.now()}
          [relaunch]
        {:else}
          [deposit]
        {/if}
      </button>

      <button
        class="border border-shitzu-4 text-shitzu-4 px-2 rounded flex items-center gap-1 hover:bg-shitzu-4/10"
        on:click={() => {
          openBottomSheet(
            TokenCommentSheet,
            {
              meme: $memebid$,
            },
            "l",
          );
        }}
      >
        <div class="i-mdi:comment-outline size-4" />
        {$memebid$.replies_count}
      </button>
    </div>
  </div>
</div>
