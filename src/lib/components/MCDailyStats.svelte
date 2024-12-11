<script lang="ts">
  import LoadingLambo from "./memecooking/Board/LoadingLambo.svelte";

  import Near from "$lib/assets/Near.svelte";
  import { dailyStatsStore } from "$lib/store/dailyStats";
  import { FixedNumber } from "$lib/util";

  // Calculate stats for last 7 days
  $: last7DaysStats = $dailyStatsStore.memeStats.slice(-7);

  // Calculate aggregate totals
  $: totalStats = last7DaysStats.reduce(
    (acc, day) => ({
      total_memes: acc.total_memes + day.total_memes,
      total_launched_memes: acc.total_launched_memes + day.total_launched_memes,
      total_finalized_memes:
        acc.total_finalized_memes + day.total_finalized_memes,
    }),
    {
      total_memes: 0,
      total_launched_memes: 0,
      total_finalized_memes: 0,
    },
  );

  // Process token statistics
  $: last7DaysTokenStats = $dailyStatsStore.tokenStats
    // Filter for last 7 days
    .filter((stat) => last7DaysStats.some((day) => day.date === stat.date))
    // Aggregate by token
    .reduce(
      (acc, stat) => {
        const existing = acc.find((t) => t.token_id === stat.token_id);
        if (existing) {
          existing.total_volume = (
            BigInt(existing.total_volume || 0) + BigInt(stat.total_volume || 0)
          ).toString();
          existing.total_protocol_fees = (
            BigInt(existing.total_protocol_fees || 0) +
            BigInt(stat.total_protocol_fees || 0)
          ).toString();
          return acc;
        }
        return [...acc, stat];
      },
      [] as typeof $dailyStatsStore.tokenStats,
    )
    // Sort by volume and get top 10
    .sort((a, b) => Number(b.total_volume || 0) - Number(a.total_volume || 0))
    .slice(0, 10);
</script>

<!-- Loading State -->
{#if $dailyStatsStore.loading}
  <LoadingLambo />

  <!-- Error State -->
{:else if $dailyStatsStore.error}
  <div class="text-red-500 text-center p-4 bg-red-900 rounded-lg">
    {$dailyStatsStore.error}
  </div>

  <!-- Data Display -->
{:else if last7DaysStats.length}
  <div class="grid gap-6">
    <!-- Token Stats Section - Most Important Data First -->
    <div class="bg-gray-800 rounded-lg overflow-hidden">
      <div class="p-4 bg-gray-900 border-b border-gray-700">
        <h2 class="text-xl font-semibold text-white">
          Protocol Performance (7 Days)
        </h2>
      </div>
      <div class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Volume Stats -->
          <div class="bg-gray-900 p-4 rounded-lg">
            <div class="flex items-center justify-between">
              <h3 class="text-sm text-gray-400">Volume</h3>
              <span
                class="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full"
                >7 Days</span
              >
            </div>
            <div class="flex items-center gap-1 mt-2">
              <p class="text-2xl font-bold text-white">
                {last7DaysTokenStats[0]?.total_volume
                  ? new FixedNumber(
                      last7DaysTokenStats[0].total_volume,
                      24,
                    ).format()
                  : "0"}
              </p>
              <Near className="size-4 bg-white rounded-full text-black" />
            </div>
            <p class="text-xs text-gray-400 mt-1">Total volume</p>
          </div>

          <!-- Protocol Fees -->
          <div class="bg-gray-900 p-4 rounded-lg">
            <div class="flex items-center justify-between">
              <h3 class="text-sm text-gray-400">Protocol Revenue</h3>
              <span
                class="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full"
                >7 Days</span
              >
            </div>
            <div class="flex items-center gap-1 mt-2">
              <p class="text-2xl font-bold text-white">
                {last7DaysTokenStats[0]?.total_protocol_fees
                  ? new FixedNumber(
                      last7DaysTokenStats[0].total_protocol_fees,
                      24,
                    ).format()
                  : "0"}
              </p>
              <Near className="size-4 bg-white rounded-full text-black" />
            </div>
            <p class="text-xs text-gray-400 mt-1">Protocol fees generated</p>
          </div>
        </div>
      </div>

      <div class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Total Memes -->
          <div class="bg-gray-900 p-4 rounded-lg">
            <div class="flex items-center justify-between">
              <h3 class="text-sm text-gray-400">Created Memes</h3>
              <span
                class="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full"
                >Total</span
              >
            </div>
            <p class="text-2xl font-bold text-white mt-2">
              {totalStats.total_memes}
            </p>
            <p class="text-xs text-gray-400 mt-1">Total memes created</p>
          </div>

          <!-- New Launches -->
          <div class="bg-gray-900 p-4 rounded-lg">
            <div class="flex items-center justify-between">
              <h3 class="text-sm text-gray-400">New Launches</h3>
              <span
                class="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full"
                >7 Days</span
              >
            </div>
            <p class="text-2xl font-bold text-white mt-2">
              {totalStats.total_launched_memes}
            </p>
            <p class="text-xs text-gray-400 mt-1">Recently launched memes</p>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
