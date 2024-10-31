<script lang="ts">
  import SHITZU_SUIT from "$lib/assets/static/shitzu_suit.png";
  import VestingChart from "$lib/components/VestingChart";
  import type { Meme } from "$lib/models/memecooking";

  export let meme: Meme;
</script>

<div class="w-full">
  {#if meme.team_allocation_num && typeof meme.vesting_duration_ms === "number" && typeof meme.cliff_duration_ms === "number"}
    <h2 class="text-lg font-medium mb-3 flex items-center gap-2 text-shitzu-4">
      <img src={SHITZU_SUIT} alt="Shitzu Suit" class="size-10 scale-x-[-1]" />
      Token Allocation
    </h2>
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
</div>
