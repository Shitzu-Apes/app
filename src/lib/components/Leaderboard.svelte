<script lang="ts">
  import LeaderboardImpl from "./Leaderboard/index.svelte";

  // Accept raw leaderboard data and primary NFT data
  export let leaderboardData: [string, [string, string | null][]][];
  export let primaryNftData: [string, string] | null = null;
  export let limit: number = 500;
  export let displayPerPage = 7;
</script>

<LeaderboardImpl {leaderboardData} {primaryNftData} {limit} {displayPerPage} />
