<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let tabs: { id: string; label: string; icon?: string }[] = [];
  export let activeTab: string | null = null;
  let className = "";
  export let tabClass = "";
  export { className as class };

  const dispatch = createEventDispatcher<{
    change: string;
  }>();

  function handleTabClick(tabId: string) {
    activeTab = tabId;
    dispatch("change", tabId);
  }

  // Get active tab index for slider positioning
  $: activeIndex = activeTab
    ? tabs.findIndex((tab) => tab.id === activeTab)
    : 0;
</script>

<div
  class="flex justify-center rounded-lg items-center {className} bg-gray-800 relative"
>
  {#if activeTab !== null}
    <div
      class="absolute h-[calc(100%)] bg-shitzu-3 rounded-lg transition-all duration-150 ease-out"
      style="width: calc(100% / {tabs.length}); left: calc({activeIndex} * (100% / {tabs.length})); top: 0px;"
    />
  {/if}
  {#each tabs as tab}
    <button
      class="py-2 relative z-10 {tabClass} {activeTab === tab.id
        ? 'text-black'
        : 'text-gray-400 hover:text-white'} flex-grow basis-0 cursor-pointer whitespace-nowrap flex items-center justify-center"
      on:click={() => handleTabClick(tab.id)}
    >
      {#if tab.icon}
        <img src={tab.icon} alt="" class="w-5 h-5 mr-2" />
      {/if}
      {tab.label}
    </button>
  {/each}
</div>
