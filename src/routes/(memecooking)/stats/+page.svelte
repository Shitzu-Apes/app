<script lang="ts">
  import { onMount } from "svelte";

  import SHITZU_NOTE from "$lib/assets/static/shitzu_note.png";
  import MCDailyStats from "$lib/components/MCDailyStats.svelte";
  import MCLeaderboard from "$lib/components/MCLeaderboard.svelte";
  import LoadingLambo from "$lib/components/memecooking/Board/LoadingLambo.svelte";
  import { dailyStatsStore } from "$lib/store/dailyStats";
  import { leaderboardStore } from "$lib/store/leaderboard";

  onMount(() => {
    leaderboardStore.fetchLeaderboards();
    dailyStatsStore.fetchStats();
  });
</script>

<div class="container mx-auto pt-4">
  <h1 class="text-2xl font-bold mb-6 flex items-end gap-2 text-shitzu-4">
    <img src={SHITZU_NOTE} class="size-24" alt="Shitzu Note" />
    Protocol Stats
  </h1>
  <!-- Main Content Grid -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    {#if $leaderboardStore.loading || $dailyStatsStore.loading}
      <div class="col-span-3 flex justify-center items-center h-64 w-full">
        <LoadingLambo />
      </div>
    {:else}
      <!-- Daily Stats Section (2/3) -->
      <div class="lg:col-span-2">
        <MCDailyStats />
      </div>

      <!-- Leaderboard Section (1/3) -->
      <div class="lg:col-span-1">
        <MCLeaderboard />
      </div>
    {/if}
  </div>
</div>
