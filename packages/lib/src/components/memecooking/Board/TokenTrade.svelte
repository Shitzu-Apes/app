<script lang="ts">
  import DexscreenerTrade from "./DexscreenerTrade.svelte";
  import McTrade from "./MCTrade.svelte";

  import type { Meme } from "$lib/api/client";
  import type { paths } from "$lib/api/openapi";

  export let memebid: Meme;
  export let trades: Promise<
    Array<
      paths["/trades"]["get"]["responses"]["200"]["content"]["application/json"][number] & {
        tokenAmount: number;
      }
    >
  >;
  export let touchToStart = false;
  export let paginated = true;
</script>

{#if memebid.pool_id}
  <DexscreenerTrade pool_id={memebid.pool_id.toString()} />
{:else}
  <McTrade meme_id={memebid.meme_id} {trades} {touchToStart} {paginated} />
{/if}
