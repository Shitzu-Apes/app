<script lang="ts">
  import SHITZU_SUIT from "$lib/assets/static/shitzu_suit.png";
  import VestingChart from "$lib/components/VestingChart";
  import type { Meme } from "$lib/models/memecooking";
  import { FixedNumber } from "$lib/util";

  export let meme: Meme;

  let className: string = "";
  export { className as class };

  $: totalSupply = new FixedNumber(meme.total_supply, meme.decimals);
  $: teamAllocationBps =
    BigInt(meme.team_allocation ?? "0") && BigInt(meme.total_supply ?? "0")
      ? (BigInt(meme.team_allocation ?? "0") /
          BigInt(meme.total_supply ?? "0")) *
        10000n
      : 0n;
  $: teamAllocationPercentage = Number(teamAllocationBps) / 100;
  $: teamAllocation = totalSupply.mul(
    new FixedNumber(BigInt(Math.round(Number(teamAllocationBps))), 4),
  );

  function formatDuration(ms: number): string {
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const months = Math.floor(days / 30);
    return months > 0 ? `${months} months` : `${days} days`;
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString();
  }
</script>

<div class="{className} w-full">
  {#if BigInt(meme.team_allocation ?? "0") > 0n && typeof meme.vesting_duration_ms === "number" && typeof meme.cliff_duration_ms === "number"}
    <div class="space-y-6">
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-medium flex items-center gap-2 text-shitzu-4">
            <img
              src={SHITZU_SUIT}
              alt="Shitzu Suit"
              class="size-10 scale-x-[-1]"
            />
            Team Token Vesting
          </h3>
        </div>

        <div class="w-full">
          <VestingChart
            teamAllocation={{
              allocationBps: Number(teamAllocationBps),
              vestingDurationMs: meme.vesting_duration_ms,
              cliffDurationMs: meme.cliff_duration_ms,
            }}
          />
        </div>

        <div class="flex flex-col gap-4 mt-4">
          <div class="flex items-center gap-1">
            <span class="w-6 flex justify-center flex-shrink-0">
              <div class="i-mdi:account-group text-memecooking-400" />
            </span>
            <span class="text-memecooking-400 text-sm font-medium"
              >Team Allocation:</span
            >
            <span class="font-medium ml-auto">
              <span class="text-xs text-gray-400 mr-1"
                >({teamAllocationPercentage.toFixed(2)}%)</span
              >
              {teamAllocation.format()}
            </span>
          </div>

          <div class="flex items-center gap-1">
            <span class="w-6 flex justify-center flex-shrink-0">
              <div class="i-mdi:gavel text-memecooking-400" />
            </span>
            <span class="text-memecooking-400 text-sm font-medium"
              >Auction End:</span
            >
            <span class="font-medium ml-auto">
              {#if meme.end_timestamp_ms}
                {formatDate(meme.end_timestamp_ms)}
              {/if}
            </span>
          </div>

          <div class="flex items-center gap-1">
            <span class="w-6 flex justify-center flex-shrink-0">
              <div class="i-mdi:clock text-memecooking-400" />
            </span>
            <span class="text-memecooking-400 text-sm font-medium"
              >Cliff End:</span
            >
            <span class="font-medium ml-auto">
              <span class="text-xs text-gray-400 mr-1"
                >({formatDuration(meme.cliff_duration_ms)})</span
              >
              {#if meme.end_timestamp_ms}
                {formatDate(meme.end_timestamp_ms + meme.cliff_duration_ms)}
              {/if}
            </span>
          </div>

          <div class="flex items-center gap-1">
            <span class="w-6 flex justify-center flex-shrink-0">
              <div class="i-mdi:calendar text-memecooking-400" />
            </span>
            <span class="text-memecooking-400 text-sm font-medium"
              >Vesting End:</span
            >
            <span class="font-medium ml-auto">
              <span class="text-xs text-gray-400 mr-1"
                >({formatDuration(meme.vesting_duration_ms)})</span
              >
              {#if meme.end_timestamp_ms}
                {formatDate(meme.end_timestamp_ms + meme.vesting_duration_ms)}
              {/if}
            </span>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>
