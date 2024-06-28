<script context="module" lang="ts">
  import { writable } from "svelte/store";

  const open = writable(false);
  const component = writable<{
    // @esline need to support all Svelte components
    component: typeof SvelteComponent<any>;
    props: Record<string, any>;
  } | null>(null);

  export function openBottomSheet(
    newComponent: typeof SvelteComponent<any>,
    props: Record<string, any> = {},
  ) {
    open.set(true);
    component.set({ component: newComponent, props });
  }

  export function close() {
    open.set(false);
    component.set(null);
  }
</script>

<script lang="ts">
  import { SvelteComponent } from "svelte";
  import type { colorVariant } from "$lib/models/variant";

  export let variant: colorVariant = "lime";
</script>

<div
  class="fixed bg-black bottom-0 left-0 right-0 w-full max-w-[min(30rem,100%)] mx-auto h-[90svh] z-1000 transform {$open
    ? 'translate-y-0'
    : 'translate-y-full'} duration-500 rounded-t-xl border-3 border-b-0 {variant ===
  'lime'
    ? 'border-lime'
    : 'border-shitzu-4'}"
>
  <div class="h-full">
    <button
      class="absolute top-3 right-3 {variant === 'lime'
        ? 'bg-lime'
        : 'bg-shitzu-4'} rounded-full flex justify-center items-center px-1 py-1"
      on:click={close}
    >
      <div class=" block i-mdi:close size-6 ml-auto bg-black" />
    </button>
    {#if $component}
      <svelte:component this={$component.component} {...$component.props} />
    {/if}
  </div>
</div>
