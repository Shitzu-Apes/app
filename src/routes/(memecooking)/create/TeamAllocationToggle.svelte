<script lang="ts">
  import TeamAllocationDefault, {
    ALLOCATION_DEFAULT_OPTIONS,
  } from "./TeamAllocationDefault.svelte";

  import type { TeamAllocation } from "$lib/models/memecooking";

  export let teamAllocation: TeamAllocation | null = null;

  let enabled = false;

  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  // Update teamAllocation based on toggle state
  $: if (enabled && !teamAllocation) {
    // Initialize with small allocation defaults when enabled
    teamAllocation = {
      allocationBps: ALLOCATION_DEFAULT_OPTIONS.small.allocationBps,
      vestingDurationMs:
        ALLOCATION_DEFAULT_OPTIONS.small.vestingDurationDays * MS_PER_DAY,
      cliffDurationMs:
        ALLOCATION_DEFAULT_OPTIONS.small.cliffDurationDays * MS_PER_DAY,
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
