<script lang="ts">
  import { match } from "ts-pattern";

  import SearchBox from "../../SearchBox.svelte";
  import VirtualMemeList from "../../VirtualMemeList.svelte";
  import LoadingLambo from "../LoadingLambo.svelte";
  import Tabs from "../Tabs.svelte";

  import LiveToggle from "./LiveToggle.svelte";
  import QuickActionConfig from "./QuickActionConfig.svelte";
  import SortToggle from "./SortToggle.svelte";

  import SelectBox from "$lib/components/SelectBox.svelte";
  import { external_memes } from "$lib/external_memes";
  import {
    memebids$,
    memebidsLoading$,
    memebidsError$,
    searchQuery$,
  } from "$lib/store/memebids";
  import {
    orderOptions,
    filterAndSortMeme,
    sortOptions,
  } from "$lib/util/sortMeme";

  let selectedSort = sortOptions[0];
  let selectedDirection = orderOptions[0];
  let activeTab: "launched" | "all" | "other" = "all";
  let quickActionAmount = "5";

  let liveOnly = false;

  const tabs = [
    { id: "all", label: "Menu" },
    { id: "launched", label: "Cooked" },
    { id: "other", label: "Imported" },
  ];

  $: displayedMemebids = match(activeTab)
    .with("other", () =>
      filterAndSortMeme(
        Object.values(external_memes),
        {
          sort: selectedSort.value,
          order: selectedDirection.value,
        },
        $searchQuery$,
        false,
        false,
      ).map((meme) => ({
        meme,
      })),
    )
    .otherwise(() =>
      filterAndSortMeme(
        $memebids$,
        {
          sort: selectedSort.value,
          order: selectedDirection.value,
        },
        $searchQuery$,
        liveOnly,
        activeTab === "launched",
      ).map((meme) => ({
        meme,
      })),
    );
</script>

<div class="w-full">
  <div class="w-full flex justify-center items-center">
    <div class="w-full flex justify-between items-stretch gap-2 px-1">
      <div class="w-full max-w-sm">
        <SearchBox />
      </div>
      <a
        href="/create"
        class="px-2 bg-memecooking-400 text-black hover:brightness-110 rounded-md flex items-center justify-center gap-1 font-medium text-sm whitespace-nowrap"
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

  {#if $memebidsLoading$}
    <div class="w-full my-10">
      <LoadingLambo />
    </div>
  {:else if $memebidsError$}
    <div class="w-full my-10">
      {$memebidsError$.message}
    </div>
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
