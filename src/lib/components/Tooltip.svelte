<script lang="ts">
  import { createTooltip, melt } from "@melt-ui/svelte";
  import { fade } from "svelte/transition";

  export let info: string | undefined = undefined;

  const {
    elements: { trigger, content, arrow },
    states: { open },
  } = createTooltip({
    positioning: {
      placement: "top",
    },
    openDelay: 0,
    closeDelay: 0,
    closeOnPointerDown: false,
    forceVisible: true,
  });
</script>

<button type="button" use:melt={$trigger} aria-label="Add">
  <slot />
</button>

{#if $open}
  <div
    use:melt={$content}
    transition:fade={{ duration: 100 }}
    class=" z-10 rounded-lg bg-white shadow"
  >
    <div use:melt={$arrow} />
    {#if info}
      <p class="px-4 py-1 text-magnum-700">{info}</p>
    {:else}
      <slot name="info" />
    {/if}
  </div>
{/if}
