<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";

  type ListboxOption = {
    label: string;
    value: string;
  };

  export let options: ListboxOption[];
  export let selected: ListboxOption;
  export let sameWidth = false;

  let isOpen = false;
  let triggerEl: HTMLButtonElement;
  let menuEl: HTMLDivElement;

  function handleTriggerClick() {
    isOpen = !isOpen;
  }

  function handleOptionClick(option: ListboxOption) {
    selected = option;
    isOpen = false;
  }

  function handleClickOutside(event: MouseEvent) {
    if (
      !triggerEl?.contains(event.target as Node) &&
      !menuEl?.contains(event.target as Node)
    ) {
      isOpen = false;
    }
  }

  onMount(() => {
    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  });
</script>

<div class="relative flex flex-col gap-1 text-sm">
  <button
    bind:this={triggerEl}
    class="flex h-8 items-center justify-between rounded-lg bg-gray-800 px-3 py-1
    text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 transition-colors"
    on:click={handleTriggerClick}
    aria-label="Select Box"
    aria-expanded={isOpen}
    aria-haspopup="listbox"
  >
    {selected?.label}
    <div class="i-mdi:chevron-down size-4 ml-2" />
  </button>

  {#if isOpen}
    <div
      bind:this={menuEl}
      class="absolute top-full left-0 z-10 flex max-h-[300px] translate-y-1 flex-col overflow-y-auto rounded-lg bg-gray-800 p-1 shadow-lg border border-gray-700 focus:!ring-0 text-sm"
      style={sameWidth ? "width: 100%" : "min-width: 100%"}
      role="listbox"
      transition:fade={{ duration: 150 }}
    >
      {#each options as item}
        <button
          class="relative cursor-pointer rounded-lg py-1.5 px-2 text-gray-400
              hover:bg-gray-700 hover:text-white focus:z-10
              data-[highlighted]:bg-gray-700 data-[highlighted]:text-white
              data-[disabled]:opacity-50 flex items-center gap-2 whitespace-nowrap"
          role="option"
          tabindex="0"
          aria-selected={selected?.value === item.value}
          on:click={() => handleOptionClick(item)}
        >
          <div
            class="i-mdi:check size-4 {selected?.value === item.value
              ? 'opacity-100'
              : 'opacity-0'}"
          />
          {item.label}
        </button>
      {/each}
    </div>
  {/if}
</div>
