<script lang="ts">
  import { createRefPoolsQuery } from "$lib/api/queries/ref";

  $: refPoolsQuery = createRefPoolsQuery();
</script>

{#if $refPoolsQuery.status === "pending"}
  <div class="i-mdi:loading size-[10rem] animate-spin mx-auto" />
{:else if $refPoolsQuery.status === "error"}
  <div class="text-red-500 text-center">Error loading pools</div>
  <pre>{$refPoolsQuery.error}</pre>
{:else}
  <slot />
{/if}
