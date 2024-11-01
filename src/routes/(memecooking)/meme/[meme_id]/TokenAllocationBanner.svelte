<script lang="ts">
  import { slide } from "svelte/transition";

  import TeamAllocationSheet from "$lib/components/memecooking/BottomSheet/TeamAllocationSheet.svelte";
  import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { wallet } from "$lib/near";

  const { accountId$ } = wallet;

  export let meme: Meme;
</script>

{#if meme.team_allocation_num && meme.team_allocation_num > 0 && meme.end_timestamp_ms != null && meme.end_timestamp_ms < Date.now() && meme.end_timestamp_ms > Date.now() && meme.owner === $accountId$}
  <div
    out:slide
    class="bg-shitzu-4 rounded-md p-4 mb-4 flex flex-col justify-between items-stretch gap-4"
  >
    <p class="text-gray-8 text-center sm:text-left">
      <span class="text-xl text-center">Team Allocation Available</span>
    </p>
    <button
      on:click={() => openBottomSheet(TeamAllocationSheet, { meme })}
      class="bg-gray-1 hover:bg-memecooking-1 text-black font-bold py-2 px-4 rounded transition duration-300 ease-in-out w-full sm:w-auto"
    >
      [Claim Team Allocation]
    </button>
  </div>
{/if}
