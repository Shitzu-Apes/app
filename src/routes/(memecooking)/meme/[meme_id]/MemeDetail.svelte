<script lang="ts">
  import { onMount } from "svelte";
  import type { Writable } from "svelte/store";

  import ClaimBanner from "./ClaimBanner.svelte";
  import TokenAllocationBanner from "./TokenAllocationBanner.svelte";
  import WithdrawBanner from "./WithdrawBanner.svelte";

  import ExtraDetail from "$lib/components/ExtraDetail.svelte";
  import { addToast } from "$lib/components/Toast.svelte";
  import ActionButtons from "$lib/components/memecooking/Board/ActionButtons.svelte";
  import TradeTabs from "$lib/components/memecooking/Board/Desktop/TradeTabs.svelte";
  import McActionBox from "$lib/components/memecooking/Board/MCActionBox.svelte";
  import SocialLink from "$lib/components/memecooking/Board/SocialLink.svelte";
  import TokenChart from "$lib/components/memecooking/Board/TokenChart.svelte";
  import TokenHolder from "$lib/components/memecooking/Board/TokenHolder.svelte";
  import RefWhitelistSheet from "$lib/components/memecooking/BottomSheet/RefWhitelistSheet.svelte";
  import Chef from "$lib/components/memecooking/Chef.svelte";
  import Countdown from "$lib/components/memecooking/Countdown.svelte";
  import ProgressBar from "$lib/components/memecooking/ProgressBar.svelte";
  import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { wallet } from "$lib/near";
  import { MCTradeSubscribe } from "$lib/store/memebids";
  import { getTokenId } from "$lib/util/getTokenId";

  export let meme$: Writable<Meme>;
  const { projectedMcap } = $meme$;
  const { accountId$ } = wallet;

  const MCSymbol = Symbol();
  onMount(() => {
    MCTradeSubscribe(MCSymbol, (data) => {
      if (data.meme_id === $meme$.meme_id) {
        $meme$ = data;
      }
    });
  });
</script>

<div class="container mx-auto px-4 py-6">
  <!-- Header Section -->
  <header class="mb-8">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <!-- Token Basic Info -->
      <div class="flex items-center gap-4">
        <img
          src="{import.meta.env.VITE_IPFS_GATEWAY}/{$meme$.image}"
          alt={$meme$.name}
          class="w-16 object-contain bg-white"
        />
        <div>
          <h1 class="text-2xl font-medium">{$meme$.name}</h1>
          <div class="flex items-center gap-2 text-gray-400">
            <span class="font-medium text-shitzu-400">${$meme$.symbol}</span>
            {#if $meme$.pool_id}
              <div class="flex items-center gap-1">
                <span class="text-xs">CA:</span>
                <code class="text-xs bg-gray-800 px-2 py-1 rounded">
                  {getTokenId($meme$.symbol, $meme$.meme_id)}
                </code>
                <button
                  class="p-1 hover:bg-gray-700 rounded"
                  on:click={() => {
                    navigator.clipboard.writeText(
                      getTokenId($meme$.symbol, $meme$.meme_id),
                    );
                    addToast({
                      data: {
                        type: "simple",
                        data: {
                          title: "Copied",
                          description: "Contract address copied!",
                          color: "green",
                        },
                      },
                    });
                  }}
                >
                  <div class="i-mdi:content-copy text-lg" />
                </button>
              </div>
            {/if}
          </div>
        </div>
      </div>

      <!-- Key Metrics -->
      <div class="flex items-center gap-6">
        <div class="text-center">
          <div class="text-sm text-gray-400">Market Cap</div>
          <div class="font-bold text-xl">
            {#if $projectedMcap}
              ${$projectedMcap.format({
                maximumFractionDigits: 1,
                notation: "compact",
              })}
            {:else}
              -
            {/if}
          </div>
        </div>
        <div class="text-center">
          <div class="text-sm text-gray-400">Created By</div>
          <Chef
            account={$meme$.owner}
            asLink
            class="bg-shitzu-3 text-black px-2 py-1 rounded-full text-sm"
          />
        </div>
      </div>
    </div>

    <!-- Progress/Status Bar -->
    {#if !$meme$.pool_id}
      <div class="mt-6">
        <ProgressBar meme={$meme$} />
      </div>
    {/if}
  </header>

  <!-- Main Content -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
    <!-- Left Column - Chart & Trading -->
    <div class="lg:col-span-2">
      <div class="bg-gray-800 rounded-lg p-4 mb-6 aspect-ratio-16/9">
        <TokenChart memebid={$meme$} />
      </div>

      <div class="bg-gray-800 rounded-lg p-4">
        <TradeTabs meme={$meme$} />
      </div>
    </div>

    <!-- Right Column - Actions & Info -->
    <div class="space-y-6">
      <ActionButtons meme={$meme$} />

      <!-- Trading Status -->
      {#if $meme$.pool_id}
        <div
          class="bg-[rgba(0,214,175,1)] text-black p-4 rounded-lg font-medium text-center"
        >
          Trade on Ref via Meme.Cooking
        </div>
      {:else if $meme$.end_timestamp_ms}
        <Countdown to={$meme$.end_timestamp_ms} />
      {/if}

      <!-- Admin Actions -->
      {#if $meme$.owner === $accountId$ && $meme$.pool_id}
        <button
          on:click={() => openBottomSheet(RefWhitelistSheet, { meme: $meme$ })}
          class="w-full btn btn-secondary"
        >
          Request Ref Finance Whitelist
        </button>
      {/if}

      <WithdrawBanner meme={$meme$} />
      <ClaimBanner meme={$meme$} />
      {#if $meme$.owner === $accountId$}
        <TokenAllocationBanner meme={$meme$} />
      {/if}

      <!-- Trading Box -->
      <div class="bg-gray-800 rounded-lg p-4">
        <McActionBox meme={$meme$} />
      </div>

      <!-- Social Links -->
      <SocialLink
        twitterLink={$meme$.twitterLink || ""}
        telegramLink={$meme$.telegramLink || ""}
        website={$meme$.website || ""}
      />

      <!-- Token Details -->
      <div class="bg-gray-800 rounded-lg p-4">
        <h3 class="text-lg font-bold mb-4">
          About
          <span class="text-shitzu-400 font-medium">${$meme$.symbol}</span>
        </h3>
        <p class="text-gray-300 mb-4">{$meme$.description}</p>
        <ExtraDetail meme={$meme$} />
      </div>

      <!-- Token Holders -->
      <div class="bg-gray-800 rounded-lg p-4">
        <TokenHolder meme={$meme$} />
      </div>
    </div>
  </div>
</div>
