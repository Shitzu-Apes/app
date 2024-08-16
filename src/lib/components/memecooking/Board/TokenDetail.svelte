<script lang="ts">
  import Chef from "../Chef.svelte";
  import Countdown from "../Countdown.svelte";

  import Near from "$lib/assets/Near.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { FixedNumber } from "$lib/util";

  export let memebid: Meme;
  let showDescription = false;
</script>

{#if memebid}
  <div class="flex flex-col w-full h-full items-center">
    <h2 class="flex text-2xl my-4 justify-between items-center w-full px-2">
      <div class="flex flex-col">
        {#if memebid.end_timestamp_ms}
          <Countdown to={memebid.end_timestamp_ms} class="text-shitzu-4" />
        {/if}
        <div
          class="flex items-center bg-amber text-white px-2 text-2xl rounded mb-4"
        >
          <Near className="size-6 -ml-1" />
          {new FixedNumber(memebid.total_deposit, 24).format()}
        </div>
      </div>
      <div class="flex flex-col items-end">
        <h4 class="text-base font-medium">
          {memebid.name}
          <span class="font-semibold">
            ${memebid.symbol}
          </span>
        </h4>
        <div class="flex items-center justify-end text-xs">
          created by
          <div class="w-1/2">
            <Chef
              account={memebid.owner}
              class="text-sm overflow-hidden text-ellipsis"
            />
          </div>
        </div>
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
    <div class="w-full h-auto">
      <img
        src="{import.meta.env.VITE_IPFS_GATEWAY}/{memebid.image}"
        alt="{memebid.name} icon"
        class="w-full h-full object-contain"
      />
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
