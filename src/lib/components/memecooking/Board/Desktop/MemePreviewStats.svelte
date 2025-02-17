<script lang="ts">
  import MemePreviewAuction from "./MemePreviewAuction.svelte";
  import MemePreviewLaunched from "./MemePreviewLaunched.svelte";

  import type { Meme } from "$lib/models/memecooking";
  import type { FixedNumber } from "$lib/util";

  export let memebid: Meme;
  export let nearPrice: FixedNumber;
</script>

{#if memebid.pool_id}
  <MemePreviewLaunched {memebid} {nearPrice} />
{:else}
  <MemePreviewAuction {memebid} {nearPrice} />
{/if}
