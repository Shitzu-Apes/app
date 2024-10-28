<script lang="ts">
  import type { Writable } from "svelte/store";

  import StakeSheet from "../BottomSheet/StakeSheet.svelte";
  import TokenCommentSheet from "../BottomSheet/TokenCommentSheet.svelte";

  import TokenChart from "./TokenChart.svelte";
  import TokenDetail from "./TokenDetail.svelte";
  import TokenHolder from "./TokenHolder.svelte";
  import TokenTrade from "./TokenTrade.svelte";

  import { goto } from "$app/navigation";
  import { client } from "$lib/api/client";
  import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { wallet } from "$lib/near";
  import { predictedTokenAmount } from "$lib/util/predictedTokenAmount";
  import { shareWithReferral } from "$lib/util/referral";

  export let memebid$: Writable<Meme>;

  const { accountId$ } = wallet;

  let selected = 0;

  let chartElement: HTMLElement | undefined;

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

  const tabs = ["[detail]", "[chart]", "[trade]", "[holder]"];
</script>

<div
  class="relative min-h-[calc(100vh-19rem)] max-h-[calc(100vh-19rem)] flex flex-col"
  bind:this={chartElement}
>
  <div class="overflow-auto flex flex-col flex-1 relative z-1">
    {#if selected === 0}
      <div
        class="flex flex-col justify-start items-center h-full text-shitzu-4 gap-6"
      >
        <TokenDetail memebid={$memebid$} />
      </div>
    {:else if selected === 1}
      <div class="flex flex-col flex-1">
        <TokenChart memebid={$memebid$} />
      </div>
    {:else if selected === 2}
      <div class="flex flex-col flex-1">
        <div class="flex flex-col flex-1">
          <TokenTrade memebid={$memebid$} {trades} paginated={false} />
        </div>
      </div>
    {:else if selected === 3}
      <div class="flex flex-col flex-1">
        <div class="flex-1 overflow-auto">
          <TokenHolder meme={$memebid$} />
        </div>
      </div>
    {/if}
  </div>
</div>

<div class="fixed inset-x-0 bottom-0 bg-black z-10">
  <div
    class="w-full h-8 flex justify-evenly border-b bg-shitzu-4 text-black items-center"
  >
    {#each tabs as tab, i}
      <button
        class="cursor-pointer border-r border-dark w-[33%] last:border-transparent"
        class:font-bold={selected === i}
        on:click={() => {
          selected = i;
        }}
      >
        {tab}
      </button>
    {/each}
  </div>

  <div class="w-full flex flex-col justify-center items-center pb-2 px-2 mt-3">
    <div class="flex w-full gap-2">
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
          : 'bg-shitzu-4 border-shitzu-6'} flex-grow py-2 rounded text-xl tracking-wider text-black"
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
        on:click={() => shareWithReferral($accountId$, $memebid$)}
        class="text-xl tracking-wider text-shitzu-4 hover:font-bold w-[80px]"
      >
        <span class="flex items-center justify-center"> [share] </span>
      </button>
    </div>
    <div class="w-full flex items-center mt-2 px-2">
      {#if typeof $memebid$.staker_count === "number"}
        <button
          class="text-base flex justify-center items-center gap-1 flex-grow basis-0 py-2"
          on:click={() => {
            selected = 3;
          }}
        >
          <span class="hover:font-bold">
            [{$memebid$.staker_count}
            {$memebid$.staker_count <= 1 ? "depositor" : "depositors"}]
          </span>
        </button>
      {/if}
      <div class="w-px h-6 bg-white" />
      {#if typeof $memebid$.replies_count === "number"}
        <button
          class="text-base flex justify-center items-center gap-1 flex-grow basis-0 py-2"
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
          <span class="hover:font-bold">
            [{$memebid$.replies_count}
            {$memebid$.replies_count <= 1 ? "comment" : "comments"}]
          </span>
        </button>
      {/if}
    </div>
  </div>
</div>
