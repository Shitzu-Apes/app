<script lang="ts">
  import { slide } from "svelte/transition";

  import { Faq, Donation, Leaderboard } from "$lib/components";
  import { wallet } from "$lib/near";
  import { refreshPrimaryNftOf, resolvedPrimaryNftTokenId } from "$lib/store";
  import { ranking, refreshRanking } from "$lib/store/ranking";

  const { accountId$ } = wallet;

  $: {
    if ($accountId$) {
      refreshPrimaryNftOf($accountId$);
    }
  }

  if (typeof window !== "undefined") {
    const url = new URL(window.location.href);
    const primaryNftTokenId =
      parseInt(url.searchParams.get("limit") || "10") || 10;
    refreshRanking(primaryNftTokenId);
  } else {
    refreshRanking(10);
  }
</script>

<div>
  <div class="w-full flex flex-col -mt-1">
    <div class="not-prose">
      {#await $ranking}
        <div
          transition:slide
          class="flex items-center justify-center w-full h-xs"
        >
          <div class="i-svg-spinners:blocks-wave text-size-20 text-lime" />
        </div>
      {:then ranking}
        <Leaderboard {ranking} primaryNft={$resolvedPrimaryNftTokenId} />
      {:catch error}
        <p>{error.message}</p>
      {/await}
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
            "Shitstars can be earned in three ways: Donating $SHITZU, Participating in Shitzu Boost, and Staking with Shitzu Pool.",
        },
        {
          question: "How do I get started with earning Shitstars?",
          answer:
            "To get started, you will need to acquire SHITZU Revival NFT, staked, and then follow the instructions for one of the three methods of earning Shitstars.",
        },
        {
          question: "How do I earn Shitstars through donation?",
          answer:
            "Donate SHITZU to rewards.0xshitzu.near and receive Shitstars equal to four times the donation amount.",
        },
        {
          question: "How do I earn Shitstars through Shitzu Boost?",
          answer:
            "Participate in Shitzu Boost and receive Shitstars equal to the Shitzu reward earned (x2 normal amount).",
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
