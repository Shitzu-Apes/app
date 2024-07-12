<script lang="ts">
  import Countdown from "../Countdown.svelte";

  import Near from "$lib/assets/Near.svelte";
  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";
  import type { MCMemeInfoWithReference } from "$lib/models/memecooking";
  import { FixedNumber } from "$lib/util";

  export let memebid: MCMemeInfoWithReference;
</script>

{#if memebid}
  <div class="flex flex-col w-full h-full items-center">
    <h2 class="flex text-2xl my-4 justify-between items-center w-full px-2">
      <div>
        <Countdown to={memebid.end_timestamp_ms} class="text-shitzu-4" />
        <div
          class="flex items-center bg-amber text-white px-2 text-2xl rounded mb-4"
        >
          <Near className="size-6 -ml-1" />{new FixedNumber(
            memebid.total_staked,
            24,
          ).format()}
        </div>
      </div>
      <div>
        <div class="flex flex-col items-end">
          <h4 class="text-base font-medium">
            {memebid.name} (${memebid.symbol})
          </h4>
          <div class="flex items-center text-xs">
            created by
            <img src={SHITZU_POCKET} alt="Shitzu Pocket" class="size-6" />
            <div class="text-sm overflow-hidden text-ellipsis">
              {memebid.owner}
            </div>
          </div>
        </div>
      </div>
    </h2>
    <div class="w-full h-[calc(100%-100px)]">
      <img
        src={memebid.image}
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
