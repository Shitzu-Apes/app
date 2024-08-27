<script lang="ts">
  import {
    type EmblaCarouselType,
    type EmblaOptionsType,
  } from "embla-carousel";
  import embalaCarousel from "embla-carousel-svelte";
  import { onMount } from "svelte";

  import StakeSheet from "../BottomSheet/StakeSheet.svelte";
  import TokenCommentSheet from "../BottomSheet/TokenCommentSheet.svelte";
  import { addToast } from "../Toast.svelte";

  import TokenChart from "./TokenChart.svelte";
  import TokenDetail from "./TokenDetail.svelte";
  import TokenHolder from "./TokenHolder.svelte";
  import TokenTrade from "./TokenTrade.svelte";

  import { goto, replaceState } from "$app/navigation";
  import { client } from "$lib/api/client";
  import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { wallet } from "$lib/near";
  import { MCTradeSubscribe, MCunsubscribe } from "$lib/store/memebids";
  import { FixedNumber } from "$lib/util";
  import { predictedTokenAmount } from "$lib/util/predictedTokenAmount";

  export let memebid: Meme;
  export let requiredStake: FixedNumber;

  const { accountId$ } = wallet;

  let emblaApi: EmblaCarouselType | undefined = undefined;
  let options: EmblaOptionsType = {
    axis: "x",
    loop: true,
  };

  let selected = 0;

  function prev() {
    emblaApi?.scrollPrev();
  }

  function next() {
    emblaApi?.scrollNext();
  }

  export let focused = false;

  const MCSymbol = Symbol();
  function handleIntersection(entries: IntersectionObserverEntry[]) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        focused = true;
        replaceState(`/meme/${memebid.meme_id}`, {});
        MCTradeSubscribe(MCSymbol, (newMemebid) => {
          if (newMemebid.meme_id === memebid.meme_id) {
            memebid = newMemebid;
          }
        });
      }
      // when not in viewport, unsubscribe
      if (!entry.isIntersecting) {
        MCunsubscribe(MCSymbol);
      }
    });
  }

  let observer: IntersectionObserver | undefined;
  let chartElement: HTMLElement | undefined;

  onMount(() => {
    observer = new IntersectionObserver(handleIntersection, {
      threshold: 0.1,
    });
    if (chartElement) {
      observer.observe(chartElement);
    }
    return () => {
      if (observer && chartElement) {
        observer.unobserve(chartElement);
      }
    };
  });

  const trades = client
    .GET("/trades", {
      params: {
        query: {
          meme_id: memebid.meme_id.toString(),
        },
      },
    })
    .then((trade) => {
      console.log("[trade]", trade);
      if (!trade.data) return [];

      const trades = trade.data.map((trade) => ({
        ...trade,
        tokenAmount: predictedTokenAmount({ ...trade, ...memebid }),
      }));

      return trades.sort((a, b) => b.timestamp_ms - a.timestamp_ms);
    });

  async function share() {
    const shareUrl = new URL(
      `${window.location.origin}/meme/${memebid.meme_id}`,
    );
    if ($accountId$) {
      shareUrl.searchParams.set("referral", $accountId$);
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: document.title,
          url: shareUrl.toString(),
        });
      } catch (error) {
        console.error("Error sharing:", error);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl.toString());
        addToast({
          data: {
            type: "simple",
            data: {
              title: "Success",
              description: "Link copied to clipboard!",
              color: "green",
            },
          },
        });
      } catch (error) {
        console.error("Error copying to clipboard:", error);
      }
    }
  }
</script>

<svelte:window
  on:keydown={(event) => {
    if (focused) {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        prev();
      }
    }
  }}
/>

<div class="relative h-fit" bind:this={chartElement}>
  <div
    class="overflow-hidden h-full relative"
    use:embalaCarousel={{ options, plugins: [] }}
    on:emblaInit={(event) => {
      emblaApi = event.detail;

      emblaApi.on("select", () => {
        if (emblaApi) {
          selected = emblaApi.selectedScrollSnap();
        }
      });
    }}
  >
    <div class="flex w-full h-full">
      <div
        class="flex-[0_0_100%] min-w-0 flex flex-col justify-center items-center h-full text-shitzu-4 gap-4"
      >
        <TokenDetail {memebid} {requiredStake} />
      </div>
      {#if focused}
        <div class="flex-[0_0_100%] min-w-0">
          <TokenChart {memebid} touchToStart />
        </div>
        <div class="flex-[0_0_100%] min-w-0">
          <TokenTrade meme_id={memebid.meme_id} {trades} touchToStart />
        </div>
        <div class="flex-[0_0_100%] min-w-0">
          <TokenHolder meme={memebid} />
        </div>
      {/if}
    </div>
  </div>
</div>
<div
  class="w-full h-8 flex justify-evenly border-b bg-shitzu-4 text-black items-center"
>
  {#each ["[detail]", "[chart]", "[trade]", "[holder]"] as tab, i (tab)}
    <button
      class="cursor-pointer border-r border-dark w-[33%] last:border-transparent"
      class:font-bold={selected === i}
      on:click={() => {
        emblaApi?.scrollTo(i);
      }}
    >
      {tab}
    </button>
  {/each}
</div>

<div class="w-full flex flex-col justify-center items-center pb-2 px-2 mt-3">
  <div class="flex w-full gap-2">
    <button
      on:click={(e) => {
        e.preventDefault();
        if (
          !memebid.pool_id &&
          memebid.end_timestamp_ms &&
          memebid.end_timestamp_ms < Date.now()
        ) {
          goto(`/create`);

          localStorage.setItem("meme_to_cto", JSON.stringify(memebid));
        } else {
          openBottomSheet(StakeSheet, { meme: memebid });
        }
      }}
      class="{!memebid.pool_id &&
      memebid.end_timestamp_ms &&
      memebid.end_timestamp_ms < Date.now()
        ? 'bg-memecooking-5 border-memecooking-6'
        : 'bg-shitzu-4 border-shitzu-6'} flex-grow py-2 rounded text-xl tracking-wider text-black"
    >
      {#if memebid.pool_id}
        [buy]
      {:else if memebid.end_timestamp_ms && memebid.end_timestamp_ms < Date.now()}
        [relaunch]
      {:else}
        [stake]
      {/if}
    </button>
    <button
      on:click={share}
      class="text-xl tracking-wider text-shitzu-4 hover:font-bold w-[80px]"
    >
      <span class="flex items-center justify-center"> [share] </span>
    </button>
  </div>
  <div class="w-full flex items-center mt-2 px-2">
    {#if typeof memebid.staker_count === "number"}
      <button
        class="text-base flex justify-center items-center gap-1 flex-grow basis-0 py-2"
        on:click={() => {
          emblaApi?.scrollTo(3);
        }}
      >
        <span class="hover:font-bold">
          [{memebid.staker_count}
          {memebid.staker_count <= 1 ? "staker" : "stakers"}]
        </span>
      </button>
    {/if}
    <div class="w-px h-6 bg-white" />
    {#if typeof memebid.replies_count === "number"}
      <button
        class="text-base flex justify-center items-center gap-1 flex-grow basis-0 py-2"
        on:click={() => {
          openBottomSheet(TokenCommentSheet, {
            meme: memebid,
          });
        }}
      >
        <span class="hover:font-bold">
          [{memebid.replies_count}
          {memebid.replies_count <= 1 ? "comment" : "comments"}]
        </span>
      </button>
    {/if}
  </div>
</div>
