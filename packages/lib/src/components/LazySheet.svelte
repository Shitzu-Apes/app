<script lang="ts">
  import { onMount, type SvelteComponent } from "svelte";

  /**
   * Wrapper for `openBottomSheet` that loads the sheet lazily.
   *
   * Sheets that pull in wallet / bridge / chart dependencies used to be part of
   * the first-load bundle even though they are only opened on click. Passing
   * this component to `openBottomSheet` with a `loader` keeps that code out of
   * the initial chunk.
   */
  export let loader: () => Promise<{ default: typeof SvelteComponent }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export let props: Record<string, any> = {};
  export let errorMessage = "Failed to load. Please try again.";

  let component: typeof SvelteComponent | null = null;
  let failed = false;

  onMount(async () => {
    try {
      const mod = await loader();
      component = mod.default;
    } catch (error) {
      failed = true;
      console.error("[LazySheet] failed to load sheet", error);
    }
  });
</script>

{#if component}
  <svelte:component this={component} {...props} />
{:else if failed}
  <div class="p-6 text-center text-sm text-rose-300">{errorMessage}</div>
{:else}
  <div class="flex justify-center p-6">
    <div class="i-svg-spinners:bars-fade size-6" />
  </div>
{/if}
