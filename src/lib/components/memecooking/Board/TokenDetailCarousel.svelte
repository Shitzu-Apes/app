<script lang="ts">
  import { onMount } from "svelte";

  import ClaimBanner from "../../../../routes/(memecooking)/meme/[meme_id]/ClaimBanner.svelte";
  import RefWhitelistBanner from "../../../../routes/(memecooking)/meme/[meme_id]/RefWhitelistBanner.svelte";
  import TokenAllocationBanner from "../../../../routes/(memecooking)/meme/[meme_id]/TokenAllocationBanner.svelte";
  import WithdrawBanner from "../../../../routes/(memecooking)/meme/[meme_id]/WithdrawBanner.svelte";
  import StakeSheet from "../BottomSheet/StakeSheet.svelte";

  import ActionButtons from "./ActionButtons.svelte";
  import TradeTabs from "./Desktop/TradeTabs.svelte";
  import StatusBar from "./StatusBar.svelte";
  import TokenChart from "./TokenChart.svelte";
  import TokenDetail from "./TokenDetail.svelte";
  import TokenHolder from "./TokenHolder.svelte";

  import { goto } from "$app/navigation";
  import McIcon from "$lib/components/MCIcon.svelte";
  import TeamAllocation from "$lib/components/memecooking/Board/TokenAllocation.svelte";
  import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { wallet } from "$lib/near";
  import { MCTradeSubscribe } from "$lib/store/MCWebSocket";
  const { accountId$ } = wallet;

  export let meme: Meme;

  const MCSymbol = Symbol();
  onMount(() => {
    MCTradeSubscribe(MCSymbol, (data) => {
      if (data.meme_id === meme.meme_id) {
        meme = data;
      }
    });
  });
</script>

<div class="flex-[1_1_0] flex flex-col items-stretch pb-30">
  <div class="flex mb-3 justify-between w-full px-2">
    <a href="/board" class="text-white flex items-center hover:text-shitzu-3">
      <div class="i-mdi:chevron-left size-8" />
      Back
    </a>
    <ActionButtons {meme} />
  </div>

  <!-- Status Bar -->
  <div class="px-2 mb-4">
    <div class="bg-gray-800 rounded-lg p-4 pb-0">
      <StatusBar {meme} />
    </div>
  </div>

  <!-- Token Info -->
  <div class="px-2 mb-4">
    <div class="bg-gray-800 rounded-lg p-4">
      <TokenDetail memebid={meme} />
    </div>
  </div>

  <!-- Banners -->
  <div class="flex flex-col w-full px-2">
    <!-- Admin Actions -->
    <RefWhitelistBanner {meme} />
    <WithdrawBanner {meme} />
    <ClaimBanner {meme} />
    {#if $accountId$ === meme.owner}
      <TokenAllocationBanner {meme} />
    {/if}
  </div>

  <!-- Main Content -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 px-2">
    <!-- Left Column - Chart & Trading -->
    <div class="lg:col-span-2">
      <div class="bg-gray-800 rounded-lg p-2 mb-4 aspect-ratio-3/4">
        <TokenChart memebid={meme} />
      </div>

      <div class="bg-gray-800 rounded-lg p-4">
        <TradeTabs {meme} />
      </div>
    </div>

    <!-- Right Column - Info -->
    <div class="space-y-4">
      {#if meme.team_allocation_num && typeof meme.vesting_duration_ms === "number" && typeof meme.cliff_duration_ms === "number"}
        <div class="bg-gray-800 rounded-lg p-4">
          <TeamAllocation {meme} />
        </div>
      {/if}

      <!-- Token Holders -->
      <div class="bg-gray-800 rounded-lg p-4">
        <TokenHolder {meme} />
      </div>
    </div>
  </div>
  <!-- Fixed Bottom Action Area -->
  <div
    class="fixed bottom-6 inset-x-4 bg-dark/80 backdrop-blur-sm border border-memecooking-6 p-2 lg:hidden z-20 rounded-lg"
  >
    <div class="w-full h-full flex justify-between items-center">
      <div class="flex justify-between items-center gap-2">
        <McIcon {meme} class="size-10 bg-white object-contain" />
        <div class="flex-1 min-w-0">
          <h2 class="text-base font-medium truncate leading-none">
            {meme.name}
          </h2>
          <span class="text-xs text-shitzu-400">${meme.symbol}</span>
        </div>
      </div>
      <button
        on:click={(e) => {
          e.preventDefault();
          if (
            !meme.pool_id &&
            meme.end_timestamp_ms &&
            meme.end_timestamp_ms < Date.now()
          ) {
            goto(`/create`);
            localStorage.setItem("meme_to_cto", JSON.stringify(meme));
          } else {
            openBottomSheet(StakeSheet, { meme });
          }
        }}
        class="{!meme.pool_id &&
        meme.end_timestamp_ms &&
        meme.end_timestamp_ms < Date.now()
          ? 'bg-memecooking-5 border-memecooking-6'
          : 'bg-shitzu-4 border-shitzu-6'} flex-1 py-1 rounded-lg text-lg tracking-wide text-black max-w-32 border border-b-4
          "
      >
        {#if meme.pool_id}
          Trade
        {:else if meme.end_timestamp_ms && meme.end_timestamp_ms < Date.now()}
          Relaunch
        {:else}
          Trade
        {/if}
      </button>
    </div>
  </div>
</div>
