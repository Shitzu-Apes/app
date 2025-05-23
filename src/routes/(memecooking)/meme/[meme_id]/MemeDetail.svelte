<script lang="ts">
  import TwitterVerificationBanner from "../../create/TwitterVerificationBanner.svelte";

  import ClaimBanner from "./ClaimBanner.svelte";
  import ProjectedPoolStat from "./ProjectedPoolStat.svelte";
  import RefWhitelistBanner from "./RefWhitelistBanner.svelte";
  import TokenAllocationBanner from "./TokenAllocationBanner.svelte";
  import WithdrawBanner from "./WithdrawBanner.svelte";

  import McIcon from "$lib/components/MCIcon.svelte";
  import { addToast } from "$lib/components/Toast.svelte";
  import ActionButtons from "$lib/components/memecooking/Board/ActionButtons.svelte";
  import TradeTabs from "$lib/components/memecooking/Board/Desktop/TradeTabs.svelte";
  import McActionBox from "$lib/components/memecooking/Board/MCActionBox.svelte";
  import SocialLink from "$lib/components/memecooking/Board/SocialLink.svelte";
  import StatusBar from "$lib/components/memecooking/Board/StatusBar.svelte";
  import TeamAllocation from "$lib/components/memecooking/Board/TokenAllocation.svelte";
  import TokenChart from "$lib/components/memecooking/Board/TokenChart.svelte";
  import TokenHolder from "$lib/components/memecooking/Board/TokenHolder/index.svelte";
  import Chef from "$lib/components/memecooking/Chef.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { getTokenId } from "$lib/util/getTokenId";

  export let meme: Meme;
</script>

<div class="w-full">
  <div class="flex mb-4 justify-between w-full">
    <a href="/board" class="text-white flex items-center hover:text-shitzu-3">
      <div class="i-mdi:chevron-left size-8" />
      Back
    </a>
    <ActionButtons {meme} />
  </div>
  <!-- Header Section -->
  <header class="mb-4 bg-gray-800 rounded-lg p-4">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <!-- Token Basic Info -->
      <div class="flex items-center gap-4">
        {#key meme.image}
          <McIcon {meme} class="w-16 text-[6px]" imageClass="object-contain" />
        {/key}
        <div>
          <h1 class="text-2xl font-medium">{meme.name}</h1>
          <div class="flex items-center gap-2 text-gray-400">
            <span class="font-medium text-shitzu-400">${meme.symbol}</span>
            {#if meme.pool_id}
              <div class="flex items-center gap-1">
                <span class="text-xs">CA:</span>
                <code class="text-xs bg-gray-800 px-2 py-1 rounded">
                  {meme.token_id}
                </code>
                <button
                  class="p-1 hover:bg-gray-700 rounded"
                  on:click={() => {
                    navigator.clipboard.writeText(getTokenId(meme));
                    addToast({
                      data: {
                        type: "simple",
                        data: {
                          title: "Copied",
                          description: "Contract address copied!",
                          type: "success",
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
        <ProjectedPoolStat {meme} />
        <div class="text-center">
          <div class="text-sm text-gray-400">Created By</div>
          <Chef
            account={meme.owner}
            asLink
            class="bg-shitzu-3 text-black px-2 py-1 rounded-full text-sm"
          />
        </div>
      </div>
    </div>
  </header>
  <!-- Main Content -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
    <!-- Left Column - Chart & Trading -->
    <div class="lg:col-span-2">
      <div class="bg-gray-800 rounded-lg p-4 mb-4 aspect-ratio-16/9">
        <TokenChart memebid={meme} />
      </div>

      <div class="bg-gray-800 rounded-lg p-4">
        {#key meme.meme_id}
          <TradeTabs {meme} />
        {/key}
      </div>
    </div>

    <!-- Right Column - Actions & Info -->
    <div class="space-y-4">
      <!-- Admin Actions -->
      <TwitterVerificationBanner {meme} />
      <RefWhitelistBanner {meme} />
      <WithdrawBanner {meme} />
      <ClaimBanner {meme} />
      <TokenAllocationBanner {meme} />

      <!-- Trading Status -->
      <div class="bg-gray-800 rounded-lg p-4 pb-0">
        <StatusBar {meme} />
      </div>

      <!-- Trading Box -->
      <div class="bg-gray-800 rounded-lg p-4">
        {#key meme.meme_id}
          <McActionBox {meme} />
        {/key}
      </div>

      <!-- Token Details -->
      <div class="bg-gray-800 rounded-lg p-4">
        <h3 class="text-lg font-bold mb-4">
          About
          <span class="text-shitzu-400 font-medium">${meme.symbol}</span>
        </h3>
        <p class="text-gray-300 mb-4">{meme.description}</p>
        <!-- Social Links -->
        <SocialLink {meme} />
      </div>

      <!-- Token Holders -->
      {#if meme.team_allocation && typeof meme.vesting_duration_ms === "number" && typeof meme.cliff_duration_ms === "number"}
        <div class="bg-gray-800 rounded-lg p-4">
          <TeamAllocation {meme} />
        </div>
      {/if}
      <div class="bg-gray-800 rounded-lg p-4">
        {#key meme.meme_id}
          <TokenHolder {meme} />
        {/key}
      </div>
    </div>
  </div>
</div>
