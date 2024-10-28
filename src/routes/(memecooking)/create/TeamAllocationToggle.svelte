<script lang="ts">
  import TeamAllocationDefault from "./TeamAllocationDefault.svelte";

  import type { TeamAllocation } from "$lib/models/memecooking";

  export let teamAllocation: TeamAllocation | null = null;

  let enabled = false;

  // Update teamAllocation based on toggle state
  $: if (enabled && !teamAllocation) {
    // Initialize with small allocation defaults when enabled
    teamAllocation = {
      allocationBps: 500, // From ALLOCATION_DEFAULT_OPTIONS.small
      vestingDurationMs: 6 * 24 * 60 * 60 * 1000, // 6 days in ms
      cliffDurationMs: 2 * 24 * 60 * 60 * 1000, // 2 days in ms
    };
  } else if (!enabled) {
    teamAllocation = null;
  }
</script>

<div class="space-y-4 flex flex-col items-center w-full">
  <div class="self-start flex items-center gap-2">
    <label for="team-allocation" class="text-sm text-shitzu-4 font-600">
      Team Allocation
    </label>
    <input id="team-allocation" type="checkbox" bind:checked={enabled} />
  </div>

  {#if enabled && teamAllocation}
    <TeamAllocationDefault bind:teamAllocation />
  {/if}
</div>
