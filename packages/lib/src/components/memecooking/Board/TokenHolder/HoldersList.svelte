<!-- Shared component for displaying holders list -->
<script lang="ts">
  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";

  type HolderDisplay = [string, string];
  export let holders: HolderDisplay[];
</script>

<div class="flex justify-between items-center mb-3 text-sm text-gray-400 px-2">
  <span>Total Holders</span>
  <span>
    {holders.length >= 98 ? "100+" : holders.length}
  </span>
</div>
<div class="space-y-3">
  {#each holders as [address, percentage] (address)}
    <a
      href={`/profile/${address}`}
      class="flex items-center justify-between py-1 px-2 rounded hover:bg-gray-600/30"
    >
      <div class="flex items-center gap-2">
        {#if address === "pool" || address === "v2.ref-finance.near"}
          <div class="i-mdi:pool text-shitzu-4" />
        {:else if address === "team" || address === import.meta.env.VITE_MEME_COOKING_CONTRACT_ID}
          <div class="i-mdi:account-group text-shitzu-4" />
        {:else}
          <img src={SHITZU_POCKET} alt="Account" class="size-4" />
        {/if}
        <span class="font-medium truncate max-w-[200px]">
          {address}
        </span>
      </div>
      <span class="font-medium text-shitzu-4">
        {percentage}%
      </span>
    </a>
  {/each}
</div>
