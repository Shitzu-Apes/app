<script lang="ts">
  import { match } from "ts-pattern";

  import GrowthMateAdDekstop from "../../GrowthMate/GrowthMateAdDekstop.svelte";
  import SearchBox from "../../SearchBox.svelte";
  import VirtualMemeList from "../../VirtualMemeList.svelte";
  import LoadingLambo from "../LoadingLambo.svelte";
  import Tabs from "../Tabs.svelte";

  import LiveToggle from "./LiveToggle.svelte";
  import QuickActionConfig from "./QuickActionConfig.svelte";
  import SortToggle from "./SortToggle.svelte";

  import { queryClient } from "$lib/api/queries";
  import { createPaginatedMemesQuery } from "$lib/api/queries/memes";
  import { poolStatQueryFactory } from "$lib/api/queries/poolStat";
  import SelectBox from "$lib/components/SelectBox.svelte";
  import { EXTERNAL_MEMES } from "$lib/external_memes";
  import { ScreenSize } from "$lib/models";
  import type { Meme } from "$lib/models/memecooking/types";
  import { nearWallet } from "$lib/near";
  import { widthAtLeast$ } from "$lib/screen-size";
  import { searchQuery$ } from "$lib/store/memebids";
  import {
    orderOptions,
    filterAndSortMeme,
    sortOptions,
  } from "$lib/util/sortMeme";

  const { accountId$ } = nearWallet;

  let selectedSort = sortOptions[0];
  let selectedDirection = orderOptions[0];
  let activeTab: "launched" | "all" | "other" | "metapool" = "all";
  let quickActionAmount = "5";

  let liveOnly = false;

  const tabs = [
    { id: "all", label: "Menu" },
    { id: "launched", label: "Cooked" },
    { id: "metapool", label: "Meme Wars" },
    { id: "other", label: "Imported" },
  ];

  $: if (activeTab === "launched") {
    liveOnly = false;
  }

  $: memesQuery = createPaginatedMemesQuery();

  $: {
    if ($memesQuery.data) {
      $memesQuery.data.forEach((meme: Meme) => {
        queryClient.prefetchQuery({
          ...poolStatQueryFactory.poolStat.detail(meme),
          staleTime: Infinity,
        });
      });
    }
  }

  $: displayedMemebids = match(activeTab)
    .with("other", () =>
      filterAndSortMeme(
        Object.values(EXTERNAL_MEMES),
        {
          sort: selectedSort.value,
          order: selectedDirection.value,
        },
        $searchQuery$,
        false,
        false,
        false,
      ).map((meme) => ({
        meme,
      })),
    )
    .otherwise(() =>
      filterAndSortMeme(
        $memesQuery.data ?? [],
        {
          sort: selectedSort.value,
          order: selectedDirection.value,
        },
        $searchQuery$,
        liveOnly,
        activeTab === "launched",
        false,
      ).map((meme) => ({
        meme,
      })),
    );

  $: isDekstop = widthAtLeast$(ScreenSize.Tablet);
</script>

<div class="w-full">
  <div class="w-full flex justify-center items-center">
    <div
      class="w-full flex justify-between items-center gap-2 px-1 justify-center flex-wrap"
    >
      <div class="flex flex-col justify-between flex-shrink-0">
        <SearchBox />
      </div>
      {#if $isDekstop}
        <GrowthMateAdDekstop
          unitId="xIX1la+GOKrsTIKier6+TQ=="
          format="Leaderboard"
          accountId={$accountId$}
          network="Near"
          className="rounded-md !max-w-md flex-order-[-1] mx-auto"
        />
      {:else}
        <GrowthMateAdDekstop
          unitId="hYb1MaPFOAHGNYt0h/zcHw=="
          format="Small Rectangle"
          accountId={$accountId$}
          network="Near"
          className="rounded-md !max-w-md flex-order-[-1] mx-auto"
        />
      {/if}
      <a
        href="/create"
        class="h-10 px-2 bg-memecooking-400 text-black hover:brightness-110 rounded-md flex items-center justify-center gap-1 font-medium text-sm whitespace-nowrap"
      >
        <div class="i-mdi:plus size-6" />
        Create Token
      </a>
    </div>
  </div>
  <div
    class="w-full flex flex-wrap justify-center items-center md:justify-start gap-3 px-1 my-6"
  >
    <div class="w-full md:w-fit flex justify-center">
      <LiveToggle bind:liveOnly />
    </div>
    <Tabs {tabs} bind:activeTab class="w-full max-w-sm text-sm" />

    <div class="flex items-center gap-3">
      <SelectBox options={sortOptions} bind:selected={selectedSort} />
      <SortToggle bind:selectedDirection />
    </div>

    <div class="ml-0 md:ml-auto">
      <QuickActionConfig bind:quickActionAmount />
    </div>
  </div>

  {#if $memesQuery.status === "pending"}
    <div class="w-full my-10">
      <LoadingLambo />
    </div>
  {:else if $memesQuery.status === "error"}
    <div class="w-full my-10">Something went wrong</div>
  {:else}
    <VirtualMemeList
      items={displayedMemebids}
      showCook={true}
      {quickActionAmount}
      emptyMessage="No memes found"
      update={() => {}}
      className="px-1"
    />
  {/if}
</div>
