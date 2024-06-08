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
</script>

<div
  class="min-h-screen fixed inset-0 w-full h-full z-1000 {$open
    ? 'pointer-events-auto'
    : 'pointer-events-none'}"
>
  <div
    class="absolute max-w-[min(28rem,95%)] bg-gray-9 border-3 border-lime border-b-transparent rounded-t-xl w-full mx-auto bottom-[-60px] pb-[120px] left-1/2 {$open
      ? 'translate-y-0'
      : 'translate-y-full'} -translate-x-1/2 pointer-events-auto transition duration-500 ease-in-out h-[100vh]"
  >
    <button
      class="absolute top-3 right-3 bg-lime rounded-full flex justify-center items-center px-1 py-1"
      on:click={close}
    >
      <div class=" block i-mdi:close size-6 ml-auto bg-black" />
    </button>
    <div class="h-full w-full mt-14 pb-[60px]">
      {#if $component}
        <svelte:component this={$component.component} {...$component.props} />
      {/if}
    </div>
  </div>
</div>
