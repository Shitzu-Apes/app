<script lang="ts">
  import { slide } from "svelte/transition";

  import BuyNftBanner from "./Banner/BuyNFTBanner.svelte";
  import Button from "./Button.svelte";
  import RetroGrid from "./RetroGrid.svelte";
  import Squircle from "./Squircle.svelte";

  import type { PrimaryNft } from "$lib/store";
  import { FixedNumber } from "$lib/util";

  export let ranking: {
    token_id: string;
    account_id: string;
    score: FixedNumber;
  }[];

  export let primaryNft: PrimaryNft | null;
  export let displayPerPage = 7;

  let currentPages = 0;

  $: withRanking = ranking?.map(({ token_id, account_id, score }, i) => {
    return {
      token_id,
      account_id: token_id === primaryNft?.token_id ? "You" : account_id,
      score,
      rank: i + 1,
    };
  });

  $: displayRanking = (() => {
    const displayRanking = withRanking?.slice(
      3 + displayPerPage * currentPages,
      3 + displayPerPage * (currentPages + 1),
    );

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
  })();

  const BASE_URL = import.meta.env.VITE_NFT_BASE_URL;
</script>

{#if withRanking}
  <ol
    transition:slide
    class="w-full bg-gradient-to-b bg-gradient-from-lime bg-gradient-to-emerald rounded-b-2xl py-3 overflow-hidden relative"
  >
    <RetroGrid />
    <div class="w-full flex justify-end z-1">
      <a
        href="#FAQ"
        class="text-black flex text-sm items-center mb-3 mr-3 gap-0.5"
      >
        FAQ
        <div class="i-mdi:help-circle-outline size-5" />
      </a>
    </div>
    <!-- First place -->
    <li class="flex flex-col items-center">
      <a href="/shitstars/{withRanking[0].token_id}" class="relative mb-4">
        <Squircle
          src="{BASE_URL}/{withRanking[0].token_id}.png"
          class="text-amber size-34"
        />
        <div
          class="absolute bottom-1 left-1/2 transform -translate-x-1/2 translate-y-1/2 bg-amber text-black text-center rounded-full size-7 font-bold flex justify-center items-center"
        >
          1
        </div>
      </a>

      <div
        class="font-bold text-lg leading-snug text-black max-w-[200px] text-ellipsis overflow-hidden"
      >
        {withRanking[0].account_id}
      </div>
      <div
        class="font-bold text-lg bg-amber rounded-full px-2 mt-2 text-black flex items-center gap-1"
      >
        <div class="i-mdi:stars size-6" />
        {withRanking[0].score.format()}
      </div>
    </li>

    <!-- Second place -->
    <div class="w-full flex justify-between px-2 -mt-4 z-1 relative">
      {#if withRanking.length > 1}
        <li class="flex flex-col items-center">
          <a href="/shitstars/{withRanking[1].token_id}" class="relative mb-4">
            <Squircle
              class="size-28 text-coolgray"
              src="{BASE_URL}/{withRanking[1].token_id}.png"
            />
            <div
              class="absolute bottom-1 left-1/2 transform -translate-x-1/2 translate-y-1/2 bg-coolgray text-black text-center rounded-full size-6 font-bold flex justify-center items-center text-sm"
            >
              2
            </div>
          </a>

          <div
            class="font-bold text-lg leading-snug text-black max-w-[200px] text-ellipsis overflow-hidden"
          >
            {withRanking[1].account_id}
          </div>
          <div
            class="font-bold text-lg bg-coolgray rounded-full px-2 mt-2 text-black flex items-center gap-1"
          >
            <div class="i-mdi:stars size-6" />
            {withRanking[1].score.format()}
          </div>
        </li>
      {/if}

      {#if withRanking.length > 2}
        <!-- Third Place -->
        <li class="flex flex-col items-center">
          <a href="/shitstars/{withRanking[2].token_id}" class="relative mb-4">
            <Squircle
              class="size-28 text-red"
              src="{BASE_URL}/{withRanking[2].token_id}.png"
            />
            <div
              class="absolute bottom-1 left-1/2 transform -translate-x-1/2 translate-y-1/2 bg-red text-black text-center rounded-full size-6 font-bold flex justify-center items-center text-sm"
            >
              3
            </div>
          </a>

          <div
            class="font-bold text-lg leading-snug text-black max-w-[200px] text-ellipsis overflow-hidden"
          >
            {withRanking[2].account_id}
          </div>
          <div
            class="font-bold text-lg bg-red rounded-full px-2 mt-2 text-black flex items-center gap-1"
          >
            <div class="i-mdi:stars size-6" />
            {withRanking[2].score.format()}
          </div>
        </li>
      {/if}
    </div>
  </ol>

  {#if withRanking.length > 3}
    <ol
      class="mt-5 flex flex-col border-2 border-lime rounded-xl bg-black overflow-hidden"
    >
      <div
        class="relative w-full flex items-center bg-gradient-to-r bg-gradient-from-lime bg-gradient-to-emerald border-b-2 border-lime w-full py-3 px-2 gap-6"
      >
        <BuyNftBanner variant="small" />
      </div>
      {#each displayRanking as { token_id, account_id, score, rank } (token_id)}
        <li
          class="flex justify-center items-center text-white py-3 px-3 border-b first:border-t border-lime last:border-none {account_id ===
          'You'
            ? 'bg-lime/50'
            : ''}"
        >
          <a href="/shitstars/{token_id}" class="mr-3">
            <Squircle
              class="size-18 text-lime"
              src="{BASE_URL}/{token_id}.png"
            />
          </a>

          <div class="max-w-[200px]">
            <div class="font-light text-lg text-ellipsis overflow-hidden">
              {account_id}
            </div>
            <div class="font-bold text-base flex items-center">
              <div class="i-mdi:stars size-5 mr-1" />
              {score.format()}
            </div>
          </div>

          <div
            class="ml-auto text-2xl flex justify-center items-center bg-lime size-6 text-black rounded-full text-xs font-bold"
          >
            {rank}
          </div>
        </li>
      {/each}
    </ol>
  {/if}
  <div class="flex justify-between px-1 py-4">
    <div>
      <button
        on:click={() => {
          currentPages = 0;
        }}
      >
        <div class="i-mdi:chevron-double-left size-6" />
      </button>
      <button
        on:click={() => {
          if (currentPages > 0) {
            currentPages -= 1;
          }
        }}
      >
        <div class="i-mdi:chevron-left size-6" />
      </button>
    </div>
    <div>
      {currentPages + 1} / {Math.ceil(ranking.length / displayPerPage)}
    </div>
    <div>
      <button
        on:click={() => {
          if (ranking.length > 3 + displayPerPage * (currentPages + 1)) {
            currentPages += 1;
          }
        }}
      >
        <div class="i-mdi:chevron-right size-6" />
      </button>
      <button
        class="ml-3"
        on:click={() => {
          currentPages = Math.floor(ranking.length / displayPerPage) - 1;
        }}
      >
        <div class="i-mdi:chevron-double-right size-6" />
      </button>
    </div>
  </div>

  <Button href="/account" class="">
    Stake & earn Shitstars now
    <div class="i-mdi:arrow-right size-6 ml-2" />
  </Button>
{/if}
