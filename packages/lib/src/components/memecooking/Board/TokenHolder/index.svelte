<!-- Main TokenHolder component -->
<script lang="ts">
  import StakeHolders from "./StakeHolders.svelte";
  import TokenHolders from "./TokenHolders.svelte";

  import SHITZU_STONK from "$lib/assets/static/shitzu_stonk.png";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import type { Meme } from "$lib/models/memecooking";

  export let meme: Meme;
</script>

<div class="w-full">
  <div class="">
    <h2 class="text-lg font-medium mb-3 flex items-center gap-2 text-shitzu-4">
      <img src={SHITZU_STONK} alt="Shitzu Stonk" class="size-10" />
      Top 100 Holders
      <Tooltip>
        <slot slot="info">
          <div class="px-3 py-2 text-sm">
            <p>Prelaunch: depositors distribution</p>
            <p>Successfully launched: actual list of current holders</p>
          </div>
        </slot>
        <div
          class="i-mdi:information-outline text-gray-400 hover:text-white transition-colors"
        />
      </Tooltip>
    </h2>

    {#if meme.pool_id}
      <TokenHolders {meme} />
    {:else}
      <StakeHolders {meme} />
    {/if}
  </div>
</div>
