<script lang="ts">
  import { slide } from "svelte/transition";

  import SHITZU_SUIT from "$lib/assets/static/shitzu_suit.png";
  import McIcon from "$lib/components/MCIcon.svelte";
  import TeamAllocationSheet from "$lib/components/memecooking/BottomSheet/TeamAllocationSheet.svelte";
  import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { wallet } from "$lib/near";

  const { accountId$ } = wallet;

  export let meme: Meme;
</script>

{#if meme.team_allocation_num && meme.team_allocation_num > 0 && meme.end_timestamp_ms != null && meme.end_timestamp_ms < Date.now() && meme.owner === $accountId$}
  <div out:slide class="bg-gray-800 rounded-lg p-4 mb-4">
    <div class="grid grid-cols-3 gap-4">
      <div class="flex items-center justify-center">
        <img src={SHITZU_SUIT} class="w-full" alt="Shitzu Suit" />
      </div>
      <div class="col-span-2 h-full">
        <div class="flex flex-col gap-6 justify-between h-full p-2">
          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-3">
              <div class="i-mdi:check-circle text-shitzu-3 text-3xl" />
              <h3 class="text-xl font-semibold text-gray-300">
                Team Allocation Available
              </h3>
            </div>
          </div>

          <button
            on:click={() => openBottomSheet(TeamAllocationSheet, { meme })}
            class="py-2 w-full bg-shitzu-3 text-black hover:brightness-110 transition-colors duration-200 rounded-md flex items-center justify-center gap-2 font-medium shadow-lg hover:shadow-xl"
          >
            Manage Allocation
            <McIcon {meme} class="size-4 bg-white rounded-full text-black" />
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
