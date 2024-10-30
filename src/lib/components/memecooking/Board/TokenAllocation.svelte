<script lang="ts">
  import VestingChart from "$lib/components/VestingChart";
  import type { Meme } from "$lib/models/memecooking";

  export let meme: Meme;
</script>

{#if meme.team_allocation_num && typeof meme.vesting_duration_ms === "number" && typeof meme.cliff_duration_ms === "number"}
  <div class="w-full my-2">
    <VestingChart
      teamAllocation={{
        allocationBps:
          (meme.team_allocation_num / meme.total_supply_num) * 10000,
        vestingDurationMs: meme.vesting_duration_ms,
        cliffDurationMs: meme.cliff_duration_ms,
      }}
    />
  </div>
{/if}
