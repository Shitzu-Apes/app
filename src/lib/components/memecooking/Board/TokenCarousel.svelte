<script lang="ts">
  import TokenCarouselPaginate from "./TokenCarouselPaginate.svelte";

  import SelectBox from "$lib/components/SelectBox.svelte";
  import Toggle from "$lib/components/Toggle.svelte";
  import { requiredStake } from "$lib/near/memecooking";
  import { memebids$, searchQuery$ } from "$lib/store/memebids";
  import {
    filterAndSortMeme,
    orderOptions,
    sortOptions,
  } from "$lib/util/sortMeme";
  let selectedSort = sortOptions[0];

  let selectedDirection = orderOptions[0];

  let liveOnly = false;

  $: displayedMemebids = $memebids$.then((memebids) => [
    ...filterAndSortMeme(
      memebids,
      {
        sort: selectedSort.value,
        order: selectedDirection.value,
      },
      $searchQuery$,
      liveOnly,
    ),
  ]);
</script>

<div class="flex flex-wrap justify-center gap-3 mt-6 px-4">
  <SelectBox options={sortOptions} bind:selected={selectedSort} />
  <SelectBox options={orderOptions} bind:selected={selectedDirection} />
  <Toggle bind:isOn={liveOnly}>live auction:{" "}</Toggle>
</div>
{#await Promise.all([requiredStake, displayedMemebids])}
  <section>
    <div class="flex flex-col h-screen">
      <div class="flex-[0_0_100%] min-h-0">
        <div class="h-[70%]">
          <div
            class="flex-[0_0_100%] min-w-0 flex flex-col justify-center items-center h-full text-shitzu-4 gap-4"
          >
            <h2 class="flex text-2xl">
              <span class="text-shitzu-4"> -d -h -m -s </span>
            </h2>
            <div class="flex gap-4 items-center">
              <div class="loader size-24" />
              <div class="flex flex-col gap-2">
                <!-- Created by -->
                <div class="loader w-40 h-4" />
                <!-- MCap -->
                <div class="loader w-50 h-4" />
                <!-- replies -->
                <div class="loader w-20 h-2" />
                <!-- Ticker -->
                <div class="loader w-50 h-5" />
              </div>
            </div>
            <div class="flex flex-col w-full px-4">
              <h3 class="flex">Bonding Curve</h3>
              <div class="loader w-full h-6"></div>
            </div>
          </div>
        </div>
        <div
          class="w-full h-8 flex justify-evenly border-b bg-shitzu-4 text-black items-center"
        >
          {#each ["[detail]", "[chart]", "[trade]", "[holder]"] as tab (tab)}
            <button
              class="cursor-pointer border-r border-dark w-[33%] last:border-transparent"
            >
              {tab}
            </button>
          {/each}
        </div>

        <div
          class="h-[calc(30%-32px)] w-full flex justify-center items-center pb-4 px-6"
        ></div>
      </div>
    </div>
  </section>
{:then [requiredStake, memebids]}
  <TokenCarouselPaginate {memebids} {requiredStake} />
{/await}
