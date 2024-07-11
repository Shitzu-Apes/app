<script lang="ts">
  import Countdown from "../Countdown.svelte";

  import Near from "$lib/assets/Near.svelte";
  import type { MCMemeInfoWithReference } from "$lib/models/memecooking";
  import { FixedNumber } from "$lib/util";

  export let memebid: MCMemeInfoWithReference;
</script>

<h2 class="flex text-2xl mt-9">
  <Countdown to={memebid.end_timestamp_ms} class="text-shitzu-4" />
</h2>
{#if memebid}
  <h2 class="flex items-center bg-amber text-white px-2 text-2xl rounded">
    <Near className="size-6 -ml-1" />{new FixedNumber(
      memebid.total_staked,
      24,
    ).format()}
  </h2>
  <div class="flex gap-4 items-center">
    <img
      src={memebid.image}
      alt="{memebid.name} icon"
      class="rounded-lg size-24 object-contain"
    />
    <div class="flex flex-col">
      <div class="text-lg font-bold uppercase">${memebid.symbol}</div>
      <div class="">
        <h4 class="text-md font-normal">{memebid.name}</h4>
      </div>
      <div class="w-40 overflow-hidden text-ellipsis">{memebid.owner}</div>
    </div>
  </div>

  <div class="w-3/4 flex-1 overflow-hidden line-clamp-3">
    {memebid.description}
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
