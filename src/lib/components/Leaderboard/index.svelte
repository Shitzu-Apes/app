<script lang="ts">
  import { slide } from "svelte/transition";

  import Button from "../Button.svelte";

  import RankingList from "./RankingList.svelte";
  import TopThree from "./TopThree.svelte";

  import { FixedNumber } from "$lib/util";

  // Accept raw leaderboard data and primary NFT data
  export let leaderboardData: [string, [string, string | null][]][];
  export let primaryNftData: [string, string] | null = null;
  export let limit: number = 500;
  export let displayPerPage = 7;

  // Current page state
  let currentPage = 0;

  // Create a primaryNft object from the raw data
  $: primaryNft = primaryNftData
    ? {
        token_id: primaryNftData[0],
        score: new FixedNumber(primaryNftData[1] || "0", 18),
      }
    : null;

  // Process ranking data
  $: ranking = leaderboardData
    .flatMap(([score, accounts]) =>
      accounts.map(([tokenId, accountId]) => {
        return {
          token_id: tokenId,
          account_id: accountId,
          score: new FixedNumber(score.toString(), 18),
        };
      }),
    )
    .slice(0, limit);

  // Process ranking with highlighting the user's NFT
  $: withRanking = ranking?.map(({ token_id, account_id, score }, i) => {
    return {
      token_id,
      account_id: token_id === primaryNft?.token_id ? "You" : account_id,
      score,
      rank: i + 1,
    };
  });

  // Get the top three entries
  $: topThree = withRanking?.slice(0, 3) || [];

  // Get the paginated entries for the rest of the ranking
  $: displayRanking =
    withRanking && withRanking.length > 3
      ? (() => {
          const displayRanking = withRanking.slice(
            3 + displayPerPage * currentPage,
            3 + displayPerPage * (currentPage + 1),
          );

          // Add the user's entry if not already in the current page
          if (
            displayRanking.find(({ account_id }) => account_id === "You") ===
              undefined &&
            primaryNft
          ) {
            const myRank = withRanking.find(
              ({ token_id }) => token_id === primaryNft.token_id,
            );

            if (myRank && myRank.rank > 3) {
              displayRanking.push({
                token_id: primaryNft.token_id,
                account_id: "You",
                score: myRank.score,
                rank: myRank.rank,
              });
            } else if (!myRank) {
              displayRanking.push({
                token_id: primaryNft.token_id,
                account_id: "You",
                score: primaryNft.score,
                rank: ranking.length + 1,
              });
            }
          }

          return displayRanking;
        })()
      : [];

  // Calculate total pages
  $: totalPages =
    withRanking && withRanking.length > 3
      ? Math.ceil((withRanking.length - 3) / displayPerPage)
      : 1;

  // Handle page change
  function handlePageChange(event: CustomEvent<number>) {
    currentPage = event.detail;
  }
</script>

<div transition:slide>
  <!-- Top three winners -->
  <TopThree {topThree} />

  <!-- Rest of the leaderboard -->
  <RankingList
    rankingEntries={displayRanking}
    {currentPage}
    {totalPages}
    on:page={handlePageChange}
  />

  <Button href="/account" class="mt-3">
    Stake & earn Shitstars now
    <div class="i-mdi:arrow-right size-6 ml-2" />
  </Button>
</div>
