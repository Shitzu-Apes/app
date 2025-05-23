<script lang="ts">
  import { slide } from "svelte/transition";

  import { useLeaderboardQuery } from "$lib/api/queries/rewarder";
  import { usePrimaryNftQuery } from "$lib/api/queries/rewarder";
  import { Faq, Donation, Leaderboard } from "$lib/components";
  import { nearWallet } from "$lib/near";

  const { accountId$ } = nearWallet;

  const limit = 500;
  const displayPerPage = 7;

  // Get primary NFT for the logged in user
  $: primaryNftQuery = usePrimaryNftQuery($accountId$ || "");

  // Get leaderboard data
  const leaderboardQuery = useLeaderboardQuery(limit);
</script>

<div>
  <div class="w-full flex flex-col -mt-1">
    <div class="not-prose">
      {#if $leaderboardQuery.isLoading}
        <div
          transition:slide
          class="flex items-center justify-center w-full h-xs"
        >
          <div class="i-svg-spinners:blocks-wave text-size-20 text-lime" />
        </div>
      {:else if $leaderboardQuery.isError}
        <p>{$leaderboardQuery.error?.message || "Error loading leaderboard"}</p>
      {:else if $leaderboardQuery.data}
        <Leaderboard
          leaderboardData={$leaderboardQuery.data}
          primaryNftData={$primaryNftQuery.data}
          {displayPerPage}
          {limit}
        />
      {/if}
    </div>
  </div>

  <Donation />

  <div id="FAQ">
    <Faq
      qnas={[
        {
          question: "What is Shitstars?",
          answer:
            "Shitstars is a point and reputation system within the SHITZU ecosystem. It rewards users for their participation and contributions. The individual who earns the most Shitstars is also called the Shitstar.",
        },
        {
          question: "What is the relationship between Shitstars and NFTs?",
          answer:
            "Shitstars are attached to a single primary NFT, and remain attached even if the owner of the NFT changes.",
        },
        {
          question: "How are Shitstars earned?",
          answer:
            "Shitstars can be earned in four ways: donating $SHITZU, participating in Shitzu Boost, staking with Shitzu Pool and participating on <a href='https://meme.cooking' target='_blank'>meme.cooking</a>. <br /><br />In addition, helping out community members in the SHITZU Telegram group can also earn you Shitstars. Join us at <a class='text-lime' href='https://t.me/Shitzu_Community' target='_blank'>https://t.me/Shitzu_Community</a> for more information.",
        },
        {
          question: "How do I get started with earning Shitstars?",
          answer:
            "To get started, you will need to acquire SHITZU Revival NFT, stake, and then follow the instructions for one of the four methods of earning Shitstars.",
        },
        {
          question: "How do I earn Shitstars through donation?",
          answer:
            "Donate SHITZU to rewards.0xshitzu.near and receive Shitstars equal to four times the donation amount.",
        },
        {
          question: "How do I earn Shitstars through Shitzu Boost?",
          answer:
            "Participate in Shitzu Boost and receive Shitstars equal to the Shitzu reward earned (x2 normal amount). Join us at <a class='text-lime' href='https://t.me/ShitzuTasks' target='_blank'>https://t.me/ShitzuTasks</a> for more information.",
        },
        {
          question: "How do I earn Shitstars through staking with Shitzu Pool?",
          answer:
            "Stake with the Shitzu pool and receive Shitstars equal to three times the Shitzu earned upon burning $DOGSHIT.",
        },
      ]}
    />
  </div>
</div>
