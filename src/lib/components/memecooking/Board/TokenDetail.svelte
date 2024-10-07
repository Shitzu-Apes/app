<script lang="ts">
  import ClaimBanner from "../../../../routes/(memecooking)/meme/[meme_id]/ClaimBanner.svelte";
  import WithdrawBanner from "../../../../routes/(memecooking)/meme/[meme_id]/WithdrawBanner.svelte";
  import Chef from "../Chef.svelte";
  import Countdown from "../Countdown.svelte";
  import ProgressBarMobile from "../ProgressBarMobile.svelte";

  import ExtraDetail from "$lib/components/ExtraDetail.svelte";
  import Squircle from "$lib/components/Squircle.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { FixedNumber } from "$lib/util";
  import { projectedMCap } from "$lib/util/projectedMCap";
  import { timesAgo } from "$lib/util/timesAgo";

  export let memebid: Meme;
  export let requiredStake: FixedNumber;
  let showDescription = false;

  $: reachedMcap = new FixedNumber(memebid.total_deposit, 24) >= requiredStake;
  $: mcap = projectedMCap(memebid);
</script>

{#if memebid}
  <div class="flex flex-col w-full h-full items-center">
    <div class="w-full flex gap-4">
      {#if memebid.pool_id}
        <a
          href="{import.meta.env.VITE_REF_APP_URL}/#near|{memebid.token_id}"
          target="_blank"
          rel="noopener noreferrer"
          class="w-full text-xs self-end px-1 tracking-tight bg-shitzu-3 py-1 text-black flex items-center justify-center"
        >
          live on ref <div class="i-mdi:open-in-new" />
        </a>
      {:else if memebid.end_timestamp_ms && memebid.end_timestamp_ms < Date.now()}
        {#if reachedMcap}
          <div
            class="w-full text-xs p-1 tracking-tight bg-amber-4 text-white text-center"
          >
            pending launch
          </div>
        {:else}
          <div
            class="w-full text-xs p-1 tracking-tight bg-rose-4 text-white text-center"
          >
            didn&apos;t make it
          </div>
        {/if}
      {:else}
        <ProgressBarMobile meme={memebid} />
      {/if}
    </div>
    <h2
      class="flex flex-col text-2xl mt-4 justify-start items-start w-full px-2"
    >
      <div class="flex items-start w-full">
        <div class="w-full flex items-center gap-2 mb-4">
          <Squircle
            src="{import.meta.env.VITE_IPFS_GATEWAY}/{memebid.image}"
            class="size-12 rounded-full"
            stroke={false}
          />
          <div class="flex-1 flex flex-col">
            <h4 class="text-base font-medium flex items-center gap-1">
              {memebid.name}
              <span class="font-semibold">
                ({memebid.symbol})
              </span>
              <div
                class="ml-auto flex items-center text-shitzu-2 text-sm rounded"
              >
                MCap: $
                {$mcap.format({
                  maximumFractionDigits: 1,
                })}
              </div>
            </h4>
            <div class="w-full flex items-center text-xs gap-1 text-shitzu-6">
              <div class="whitespace-nowrap">created by</div>
              <a href={`/profile/${memebid.owner}`}>
                <Chef
                  account={memebid.owner}
                  class="text-sm overflow-hidden text-ellipsis"
                />
              </a>
              <div class="i-mdi:circle-medium size-4" />
              <div class="text-xs">
                {timesAgo(new Date(memebid.created_timestamp_ms))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-col w-full">
        {#if memebid.end_timestamp_ms && memebid.pool_id === null}
          <div class="my-2">
            <Countdown
              to={memebid.end_timestamp_ms}
              class="text-shitzu-4 justify-evenly"
            />
          </div>
        {/if}
        <WithdrawBanner meme={memebid} />
        <ClaimBanner meme={memebid} />
      </div>
    </h2>
    <div class="w-full">
      <div class="px-4 py-2">
        <p class="text-sm text-gray-200">
          {#if memebid.description && memebid.description.length > 100}
            {#if showDescription}
              {memebid.description}
            {:else}
              {memebid.description.slice(0, 100)}...

              <button
                on:click={() => {
                  showDescription = true;
                }}
                class="text-shitzu-4 underline"
              >
                Read more
              </button>
            {/if}
          {:else}
            {memebid.description}
          {/if}
        </p>
      </div>
    </div>
    <div class="w-full h-auto relative">
      <img
        src="{import.meta.env.VITE_IPFS_GATEWAY}/{memebid.image}"
        alt="{memebid.name} icon"
        class="w-full h-full max-h-[25rem] object-contain"
      />
      <div class="absolute bottom-0 w-full px-4 py-2">
        <!-- backdrop -->
        <div
          class="absolute inset-0 bg-black/25 w-full h-full z-0 backdrop-blur-sm"
        />
        <!-- extra details -->
        <ExtraDetail meme={memebid} class="text-white relative z-30" />
      </div>
    </div>
  </div>
{:else}
  <div class="flex gap-4 items-center">
    <div class="loader size-24" />
    <div class="flex flex-col gap-2">
      <!-- Created by -->
      <div class="loader w-40 h-4" />
      <!-- MCap -->
      <div class="loader w-50 h-4" />
      <!-- replies -->
      <div class="loader w-20 h-2" />
      <!-- Ticker -->
      <div class="loader w-50 h-5" />
    </div>
  </div>
  <div class="flex flex-col w-full px-4">
    <h3 class="flex">Bonding Curve</h3>
    <div class="loader w-full h-6"></div>
  </div>
{/if}
