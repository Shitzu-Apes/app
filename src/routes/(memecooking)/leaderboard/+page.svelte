<script lang="ts">
  import { onMount } from "svelte";

  import Near from "$lib/assets/Near.svelte";
  import Chef from "$lib/components/memecooking/Chef.svelte";
  import { leaderboardStore } from "$lib/store/leaderboard";
  import { FixedNumber } from "$lib/util";

  let activeTab: "referral" | "withdraw" = "referral";

  onMount(() => {
    leaderboardStore.fetchLeaderboards();
  });
</script>

<div class="container mx-auto px-4 py-8">
  <h1 class="text-3xl font-bold mb-8 text-center text-white">Leaderboard</h1>

  <!-- Mobile Tab Switcher -->
  <div class="flex md:hidden justify-center mb-8">
    <div class="bg-gray-800 rounded-lg p-1">
      <button
        class="px-4 py-2 rounded-md transition-all duration-200 {activeTab ===
        'referral'
          ? 'bg-primary text-white'
          : 'text-gray-400 hover:text-white'}"
        on:click={() => (activeTab = "referral")}
      >
        Referral Fees
      </button>
      <button
        class="px-4 py-2 rounded-md transition-all duration-200 {activeTab ===
        'withdraw'
          ? 'bg-primary text-white'
          : 'text-gray-400 hover:text-white'}"
        on:click={() => (activeTab = "withdraw")}
      >
        Withdraw Fees
      </button>
    </div>
  </div>

  {#if $leaderboardStore.loading}
    <div class="flex justify-center items-center h-64">
      <div
        class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"
      />
    </div>
  {:else if $leaderboardStore.error}
    <div class="text-red-500 text-center p-4 bg-red-900/20 rounded-lg">
      {$leaderboardStore.error}
    </div>
  {:else}
    <!-- Desktop View: Two tables side by side -->
    <div class="hidden md:grid grid-cols-2 gap-6">
      <!-- Referral Fees Table -->
      <div class="bg-gray-800/50 rounded-lg overflow-hidden shadow-xl">
        <div class="p-4 bg-gray-900/50">
          <h2 class="text-xl font-semibold text-white">Referral Fees</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full">
            <thead>
              <tr class="bg-gray-900/50">
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                  >Rank</th
                >
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                  >Account</th
                >
                <th
                  class="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider"
                  >Amount</th
                >
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-700">
              {#each $leaderboardStore.referralLeaderboard as entry, index}
                <tr class="hover:bg-gray-700/30 transition-colors">
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300"
                    >{index + 1}</td
                  >
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    <Chef asLink account={entry.account_id} />
                  </td>
                  <td
                    class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300"
                  >
                    <div class="inline-flex items-center gap-1 justify-end">
                      {new FixedNumber(entry.referral_fees, 24).format()}
                      <Near
                        className="size-4 bg-white rounded-full text-black"
                      />
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Withdraw Fees Table -->
      <div class="bg-gray-800/50 rounded-lg overflow-hidden shadow-xl">
        <div class="p-4 bg-gray-900/50">
          <h2 class="text-xl font-semibold text-white">Withdraw Fees</h2>
        </div>
        <div class="overflow-x-auto">
          <table class="min-w-full">
            <thead>
              <tr class="bg-gray-900/50">
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                  >Rank</th
                >
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                  >Account</th
                >
                <th
                  class="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider"
                  >Amount</th
                >
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-700">
              {#each $leaderboardStore.withdrawLeaderboard as entry, index}
                <tr class="hover:bg-gray-700/30 transition-colors">
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300"
                    >{index + 1}</td
                  >
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    <Chef asLink account={entry.account_id} />
                  </td>
                  <td
                    class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300"
                  >
                    <div class="inline-flex items-center gap-1 justify-end">
                      {new FixedNumber(entry.withdraw_fees, 24).format()}
                      <Near
                        className="size-4 bg-white rounded-full text-black"
                      />
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Mobile View: Single table based on active tab -->
    <div class="md:hidden bg-gray-800/50 rounded-lg overflow-hidden shadow-xl">
      <div class="p-4 bg-gray-900/50">
        <h2 class="text-xl font-semibold text-white">
          {activeTab === "referral" ? "Referral Fees" : "Withdraw Fees"}
        </h2>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full">
          <thead>
            <tr class="bg-gray-900/50">
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                >Rank</th
              >
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                >Account</th
              >
              <th
                class="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider"
                >Amount</th
              >
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-700">
            {#each activeTab === "referral" ? $leaderboardStore.referralLeaderboard : $leaderboardStore.withdrawLeaderboard as entry, index}
              <tr class="hover:bg-gray-700/30 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300"
                  >{index + 1}</td
                >
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  <Chef asLink account={entry.account_id} />
                </td>
                <td
                  class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-300"
                >
                  <div class="inline-flex items-center gap-1 justify-end">
                    {activeTab === "referral"
                      ? new FixedNumber(entry.referral_fees, 24).format()
                      : new FixedNumber(entry.withdraw_fees, 24).format()}
                    <Near className="size-4 bg-white rounded-full text-black" />
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>
