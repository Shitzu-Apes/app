<script lang="ts">
  /**
   * One label/value row for the bridge summary.
   *
   * The row is always rendered so the card does not grow and reflow as quotes
   * and fees stream in; while a value is pending an inline placeholder sits in
   * its place instead of the row appearing later.
   */
  export let label: string;
  /** Omit or pass null to show the loading placeholder. */
  export let value: string | null = null;
  export let tone: "default" | "muted" | "warning" | "strong" = "default";
  export let pending = false;
</script>

<div class="flex justify-between gap-3 items-center text-sm">
  <span
    class={tone === "strong"
      ? "shrink-0 font-semibold"
      : tone === "muted"
        ? "text-shitzu-2 shrink-0 text-xs"
        : "text-shitzu-2 shrink-0"}
  >
    {label}
  </span>

  {#if pending || value === null}
    <span
      class="block h-3 rounded bg-shitzu-4/20 animate-pulse"
      style="width: {pending ? 4.5 : 3.5}rem"
      aria-hidden="true"
    />
    <span class="sr-only">Loading</span>
  {:else}
    <span
      class="text-right break-words {tone === 'warning'
        ? 'text-amber-300'
        : tone === 'strong'
          ? 'font-semibold'
          : tone === 'muted'
            ? 'text-shitzu-2 text-xs'
            : ''}"
    >
      {value}
    </span>
  {/if}
</div>
