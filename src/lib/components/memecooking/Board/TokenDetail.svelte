<script lang="ts">
  import ClaimBanner from "../../../../routes/(memecooking)/meme/[meme_id]/ClaimBanner.svelte";
  import TokenAllocationBanner from "../../../../routes/(memecooking)/meme/[meme_id]/TokenAllocationBanner.svelte";
  import WithdrawBanner from "../../../../routes/(memecooking)/meme/[meme_id]/WithdrawBanner.svelte";
  import Countdown from "../Countdown.svelte";

  import RadialProgressBar from "./Desktop/RadialProgressBar.svelte";
  import SocialLink from "./SocialLink.svelte";

  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";
  import SHITZU_STONK from "$lib/assets/static/shitzu_stonk.png";
  import McIcon from "$lib/components/MCIcon.svelte";
  import { addToast } from "$lib/components/Toast.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { wallet } from "$lib/near";
  import { getTokenId } from "$lib/util/getTokenId";
  import { createProgressBarData } from "$lib/util/progressBarLogic";

  export let memebid: Meme;
  const { accountId$ } = wallet;

  $: reachedMcap =
    BigInt(memebid.total_deposit) >= BigInt(memebid.soft_cap ?? "0");
  const { projectedMcap } = memebid;

  let props = createProgressBarData(memebid);
  $: props = createProgressBarData(memebid);
</script>

<div class="flex flex-col w-full h-full">
  <!-- Status Bar -->
  <div class="w-full flex gap-4">
    {#if memebid.pool_id}
      <div
        class="w-full bg-[rgba(0,214,175,1)] text-black p-2 text-center font-medium"
      >
        Trade on Ref via Meme.Cooking
      </div>
    {:else if memebid.end_timestamp_ms && memebid.end_timestamp_ms < Date.now()}
      {#if reachedMcap}
        <div class="w-full text-center p-2 bg-amber-4 text-white">
          pending launch
        </div>
      {:else}
        <div class="w-full text-center p-2 bg-rose-4 text-white">
          didn't make it
        </div>
      {/if}
    {:else}
      <div class="flex w-full justify-between items-center">
        {#if memebid.end_timestamp_ms && memebid.pool_id === null}
          <div class="w-1/2 flex flex-col justify-start items-start">
            <div class="text-gray-400">Remaining Time</div>
            <Countdown
              to={memebid.end_timestamp_ms}
              class="text-shitzu-4 justify-evenly text-4xl"
              format="compact"
            />
          </div>
        {/if}
        <div class="flex-shrink-1 w-1/2 flex justify-end h-full">
          <div class="flex flex-col justify-center items-start gap-1 pr-4">
            <div class="text-gray-400">Progress</div>
            <div class="text-2xl font-medium text-memecooking-400">
              {(props.progress * 100).toFixed(2)}%
            </div>
          </div>
          <div class="w-full max-w-25 h-full flex items-center">
            <RadialProgressBar meme={memebid} {props} />
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Token Basic Info -->
  <div class="flex items-start gap-4 py-4">
    <McIcon meme={memebid} class="size-16 bg-white object-contain" />
    <div class="flex-1">
      <h1 class="text-2xl font-medium">{memebid.name}</h1>
      <div class="flex items-center gap-2 text-gray-400 flex-wrap">
        <span class="font-medium text-shitzu-400">${memebid.symbol}</span>
        {#if memebid.pool_id}
          <div class="flex items-center gap-1">
            <span class="text-xs">CA:</span>
            <code class="text-xs bg-gray-800 px-2 py-1 rounded">
              {memebid.token_id}
            </code>
            <button
              class="p-1 hover:bg-gray-700 rounded"
              on:click={() => {
                navigator.clipboard.writeText(
                  getTokenId(memebid.symbol, memebid.meme_id),
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
  <!-- Description & Image -->
  <div class="flex gap-2">
    <div class="w-full">
      <div class="flex h-full">
        <div class="w-full flex flex-col gap-4">
          <!-- Description -->
          <div class="flex items-center gap-1 text-sm">
            <span class="w-6 flex justify-center flex-shrink-0">
              <div class="i-mdi:text text-memecooking-400" />
            </span>
            <span class="flex-1 text-gray-200">
              {memebid.description}
            </span>
          </div>

          <!-- Market Cap -->
          <div class="flex items-center gap-1">
            <span class="w-6 flex justify-center flex-shrink-0">
              <div class="i-mdi:chart-line text-memecooking-400" />
            </span>
            <span class="text-memecooking-400 text-sm font-medium">MC:</span>
            <span class="font-medium">
              {#if $projectedMcap}
                ${$projectedMcap.format({
                  maximumFractionDigits: 1,
                  notation: "compact",
                })}
              {:else}
                -
              {/if}
            </span>
          </div>

          <!-- Created By -->
          <div class="flex items-center gap-1">
            <span class="w-6 flex justify-center flex-shrink-0">
              <img src={SHITZU_POCKET} alt="Shitzu Pocket" class="size-6" />
            </span>
            <span
              class="text-memecooking-400 flex-shrink-0 text-sm font-medium"
            >
              By:
            </span>
            <span class="text-white text-sm truncate flex-shrink-1">
              {memebid.owner}
            </span>
          </div>

          <!-- Holders -->
          <div class="flex items-center gap-1">
            <span class="w-6 flex justify-center flex-shrink-0">
              <img src={SHITZU_STONK} alt="Shitzu Stonk" class="size-6" />
            </span>
            <span class="text-memecooking-400 text-sm font-medium"
              >Holders:</span
            >
            <span class="font-medium">
              {#if memebid.staker_count}
                {memebid.staker_count}
              {:else}
                -
              {/if}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Countdown & Banners -->
  <div class="flex flex-col w-full px-4">
    <WithdrawBanner meme={memebid} />
    <ClaimBanner meme={memebid} />
    {#if $accountId$ === memebid.owner}
      <TokenAllocationBanner meme={memebid} />
    {/if}
  </div>

  <!-- Social Links -->
  <div class="flex justify-center">
    <SocialLink
      twitterLink={memebid.twitterLink || ""}
      telegramLink={memebid.telegramLink || ""}
      website={memebid.website || ""}
    />
  </div>
</div>
