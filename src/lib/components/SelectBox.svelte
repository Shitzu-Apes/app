<script lang="ts">
  import { createSelect, melt } from "@melt-ui/svelte";
  import type { ListboxOption } from "@melt-ui/svelte/dist/builders/listbox/types";
  import { fade } from "svelte/transition";

  export let options: ListboxOption<string>[];

  let selectedOption: ListboxOption<string>;

  export let sameWidth = false;

  export { selectedOption as selected };

  const {
    elements: { trigger, menu, option },
    states: { selectedLabel, open, selected },
    helpers: { isSelected },
  } = createSelect<string>({
    forceVisible: true,
    positioning: {
      placement: "bottom",
      fitViewport: true,
      sameWidth,
    },
    defaultSelected: selectedOption,
  });

  $: selectedOption = $selected as ListboxOption<string>;
</script>

<div class="flex flex-col gap-1 text-sm">
  <button
    class="flex h-10 items-center justify-between rounded-lg bg-shitzu-4 px-2 py-1
  text-black shadow transition-opacity hover:opacity-90"
    use:melt={$trigger}
    aria-label="Select Box"
  >
    {$selectedLabel}
    <div class="i-mdi:chevron-down size-5" />
  </button>
  {#if $open}
    <div
      class="z-10 flex max-h-[300px] flex-col overflow-y-auto rounded-lg bg-shitzu-4 p-1 shadow focus:!ring-0 text-sm"
      use:melt={$menu}
      transition:fade={{ duration: 150 }}
    >
      {#each options as item}
        <div
          class="relative cursor-pointer rounded-lg py-1 px-1 text-black
              hover:bg-white hover:text-black focus:z-10
              focus:text-magnum-700
              data-[highlighted]:bg-magnum-200 data-[highlighted]:text-magnum-900
              data-[disabled]:opacity-50 flex items-center gap-2"
          use:melt={$option(item)}
        >
          <div
            class="i-mdi:check size-4 {$isSelected(item.value)
              ? 'opacity-100'
              : 'opacity-0'}"
          />

          {item.label}
        </div>
      {/each}
    </div>
  {/if}
</div>
