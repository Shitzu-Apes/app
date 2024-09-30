<script lang="ts">
  import DexscreenerChart from "./DexscreenerChart.svelte";
  import McChart from "./MCChart.svelte";

  import type { Meme } from "$lib/api/client";

  export let memebid: Meme;
  export let touchToStart: boolean = false;
</script>

{#if memebid.pool_id}
  <DexscreenerChart pool_id={memebid.pool_id.toString()} />
{:else}
  <McChart {memebid} {touchToStart} />
{/if}
