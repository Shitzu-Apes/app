<!-- Component for displaying token holders when pool exists -->
<script lang="ts">
  import { createQuery } from "@tanstack/svelte-query";

  import { holders } from "$lib/api/queries/holders";
  import HoldersList from "$lib/components/memecooking/Board/TokenHolder/HoldersList.svelte";
  import type { Meme } from "$lib/models/memecooking";

  export let meme: Meme;

  const holdersQuery = createQuery(
    holders.tokenHolders(meme.token_id!, meme.total_supply ?? "0"),
  );
</script>

{#if $holdersQuery.isLoading}
  <div class="flex justify-center py-4">
    <div class="loader w-8 h-8" />
  </div>
{:else if $holdersQuery.isError}
  <div class="text-center text-red-400 py-4">Error loading holders</div>
{:else if !$holdersQuery.data || $holdersQuery.data.length === 0}
  <div class="text-center text-gray-400 py-4">No holders yet</div>
{:else}
  <HoldersList holders={$holdersQuery.data} />
{/if}
