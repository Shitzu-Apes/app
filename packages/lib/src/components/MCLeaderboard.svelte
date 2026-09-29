<script lang="ts">
  import LoadingLambo from "./memecooking/Board/LoadingLambo.svelte";
  import Tabs from "./memecooking/Board/Tabs.svelte";
  import Chef from "./memecooking/Chef.svelte";

  import Near from "$lib/assets/Near.svelte";
  import { leaderboardStore } from "$lib/store/leaderboard";
  import { FixedNumber } from "$lib/util";

  let activeTab = "referral";
  let tabs = [
    { id: "referral", label: "Referral Fees" },
    { id: "withdraw", label: "Withdraw Fees" },
  ];
</script>

{#if $leaderboardStore.loading}
  <LoadingLambo />
{:else if $leaderboardStore.error}
  <div class="text-red-500 text-center p-4 bg-red-900/20 rounded-lg">
    {$leaderboardStore.error}
  </div>
{:else}
  <div class="bg-gray-800 rounded-lg overflow-hidden h-full flex flex-col">
    <Tabs {tabs} bind:activeTab />

    <!-- Leaderboard Content -->
    <div class="flex-1 min-h-0">
      <div class="h-full overflow-auto">
        <table class="w-full table-fixed">
          <thead>
            <tr class="bg-gray-900/30">
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[15%]"
                >Rank</th
              >
              <th
                class="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-[45%]"
                >Account</th
              >
              <th
                class="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider w-[40%]"
                >Amount</th
              >
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-700/50">
            {#each activeTab === "referral" ? $leaderboardStore.referralLeaderboard : $leaderboardStore.withdrawLeaderboard as entry, index}
              <tr class="hover:bg-gray-700/30 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    class="inline-flex items-center justify-center w-6 h-6 text-sm {index <
                    3
                      ? 'bg-primary/20 text-primary rounded'
                      : 'text-gray-400'}"
                  >
                    {index + 1}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap truncate">
                  <span class="text-sm font-medium text-white">
                    <Chef account={entry.account_id} asLink />
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right">
                  <div class="inline-flex items-center gap-1 justify-end">
                    <span class="text-sm font-medium text-white">
                      {activeTab === "referral"
                        ? new FixedNumber(entry.referral_fees, 24).format()
                        : new FixedNumber(entry.withdraw_fees, 24).format()}
                    </span>
                    <Near className="size-4 bg-white rounded-full text-black" />
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>
{/if}
