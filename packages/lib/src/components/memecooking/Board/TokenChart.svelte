<script lang="ts">
  import DexscreenerChart from "./DexscreenerChart.svelte";
  import McChart from "./MCChart.svelte";

  import type { Meme } from "$lib/api/client";

  export let memebid: Meme;
</script>

{#if memebid.pool_id}
  <DexscreenerChart pool_id={memebid.pool_id.toString()} />
{:else}
  {#key memebid.meme_id}
    <McChart {memebid} />
  {/key}
{/if}
