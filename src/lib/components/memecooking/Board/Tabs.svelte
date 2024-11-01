<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let tabs: { id: string; label: string }[] = [];
  export let activeTab: string;
  let className = "";
  export { className as class };

  const dispatch = createEventDispatcher<{
    change: string;
  }>();

  function handleTabClick(tabId: string) {
    activeTab = tabId;
    dispatch("change", tabId);
  }

  // Get active tab index for slider positioning
  $: activeIndex = tabs.findIndex((tab) => tab.id === activeTab);
</script>

<div
  class="flex justify-center rounded-lg items-center {className} bg-gray-800 relative"
>
  <div
    class="absolute h-[calc(100%)] bg-shitzu-3 rounded-lg transition-all duration-150 ease-out"
    style="width: calc(100% / {tabs.length}); left: calc({activeIndex} * (100% / {tabs.length})); top: 0px;"
  />
  {#each tabs as tab}
    <button
      class="py-2 relative z-10 {activeTab === tab.id
        ? 'text-black'
        : 'text-gray-400 hover:text-white'} flex-grow basis-0 cursor-pointer whitespace-nowrap"
      on:click={() => handleTabClick(tab.id)}
    >
      {tab.label}
    </button>
  {/each}
</div>
