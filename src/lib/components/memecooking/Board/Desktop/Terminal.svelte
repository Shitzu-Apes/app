<script lang="ts">
  import SearchBox from "../../SearchBox.svelte";
  import VirtualMemeList from "../../VirtualMemeList.svelte";
  import LoadingLambo from "../LoadingLambo.svelte";
  import Tabs from "../Tabs.svelte";

  import QuickActionConfig from "./QuickActionConfig.svelte";

  import SelectBox from "$lib/components/SelectBox.svelte";
  import { memebids$, searchQuery$ } from "$lib/store/memebids";
  import {
    orderOptions,
    filterAndSortMeme,
    sortOptions,
  } from "$lib/util/sortMeme";

  let selectedSort = sortOptions[0];
  let selectedDirection = orderOptions[0];
  let activeTab: "auction" | "live" | "all" = "all";
  let quickActionAmount = "5";

  const tabs = [
    { id: "all", label: "All" },
    { id: "auction", label: "Live" },
    { id: "live", label: "Launched" },
  ];

  $: displayedMemebids = $memebids$.then((memebids) =>
    filterAndSortMeme(
      memebids,
      {
        sort: selectedSort.value,
        order: selectedDirection.value,
      },
      $searchQuery$,
      activeTab === "auction" ? true : false,
      activeTab === "live",
    ).map((meme) => ({
      meme,
    })),
  );
</script>

<div class="w-full">
  <div class="mx-auto w-full max-w-sm">
    <SearchBox />
  </div>
  <div
    class="w-full flex flex-wrap justify-center sm:justify-start gap-3 px-1 my-6"
  >
    <Tabs {tabs} bind:activeTab class="w-full max-w-md" />
    <SelectBox options={sortOptions} bind:selected={selectedSort} />
    <SelectBox options={orderOptions} bind:selected={selectedDirection} />
    <QuickActionConfig bind:quickActionAmount />
  </div>

  {#await displayedMemebids}
    <div class="w-full my-10">
      <LoadingLambo />
    </div>
  {:then items}
    <VirtualMemeList
      {items}
      showCook={true}
      {quickActionAmount}
      emptyMessage="No memes found"
      update={() => {}}
      className="px-1"
    />
  {/await}
</div>
