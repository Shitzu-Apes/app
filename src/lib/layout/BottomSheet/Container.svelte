<script context="module" lang="ts">
  import { derived, writable, type Writable } from "svelte/store";

  const open = writable(false);
  const component = writable<{
    component: typeof SvelteComponent<any>;
    props: Record<string, any>;
  } | null>(null);
  const size$: Writable<"m" | "l"> = writable("m");

  export const isBottomSheetOpen$ = derived(open, (a) => a);

  export function openBottomSheet(
    newComponent: typeof SvelteComponent<any>,
    props: Record<string, any> = {},
    size?: "m" | "l",
  ) {
    open.set(true);
    component.set({ component: newComponent, props });
    size$.set(size ?? "m");
  }

  export function closeBottomSheet() {
    open.set(false);
    component.set(null);
  }
</script>

<script lang="ts">
  import { SvelteComponent } from "svelte";
  import type { colorVariant } from "$lib/models/variant";
  import { onMount } from "svelte";

  export let variant: colorVariant = "lime";

  let mounted = false;

  onMount(() => {
    mounted = true;
  });
</script>

{#if $open && mounted}
  <button class="fixed inset-0 bg-black/80 z-30" on:click={closeBottomSheet} />
{/if}

{#if mounted}
  <div
    class="fixed bg-black bottom-0 left-0 right-0 w-full max-w-[min(30rem,100%)] mx-auto {$size$ ===
    'm'
      ? 'h-[90svh]'
      : 'h-[95svh]'} z-40 transform {$open
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
        on:click={closeBottomSheet}
      >
        <div class=" block i-mdi:close size-6 ml-auto bg-black" />
      </button>
      {#if $component}
        <svelte:component this={$component.component} {...$component.props} />
      {/if}
    </div>
  </div>
{/if}
