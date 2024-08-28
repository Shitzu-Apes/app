<script lang="ts">
  import McDeposit from "./MCDeposit.svelte";
  import McRef from "./MCRef.svelte";

  import type { Meme } from "$lib/models/memecooking";

  export let meme: Meme;

  $: isDeposit = !meme.pool_id;
</script>

{#if isDeposit}
  <McDeposit {meme} />
{:else}
  <McRef {meme} />
{/if}
