<script lang="ts">
  import McRef from "./MCRef.svelte";
  import McStake from "./MCStake.svelte";

  import type { Meme } from "$lib/models/memecooking";

  export let meme: Meme;

  $: isStake = !meme.pool_id;
</script>

{#if isStake}
  <McStake {meme} />
{:else}
  <McRef {meme} />
{/if}
