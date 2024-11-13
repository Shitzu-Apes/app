<script lang="ts">
  import { slide } from "svelte/transition";

  import TeamAllocationDefault, {
    ALLOCATION_DEFAULT_OPTIONS,
  } from "./TeamAllocationDefault.svelte";

  import ToggleSwitch from "$lib/components/ToggleSwitch.svelte";
  import type { TeamAllocation } from "$lib/models/memecooking";

  export let teamAllocation: TeamAllocation | null = null;

  let enabled = teamAllocation !== null;

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

  function handleToggle() {
    enabled = !enabled;
  }
</script>

<div class="space-y-4 flex flex-col items-center w-full">
  <div class="self-start w-full flex justify-between items-center gap-2">
    <label for="team-allocation" class="text-sm text-shitzu-4 font-600">
      Team Allocation
    </label>
    <ToggleSwitch {enabled} on:toggle={handleToggle} />
  </div>

  {#if enabled && teamAllocation}
    <div transition:slide class="w-full">
      <TeamAllocationDefault bind:teamAllocation />
    </div>
  {/if}
</div>
