<script lang="ts">
  import Deposit from "./Deposit.svelte";

  import type { MCAccountInfo } from "$lib/models/memecooking";

  export let accountInfo: Promise<MCAccountInfo | null>;
</script>

<div class="my-6">
  {#await accountInfo}
    <div class="i-svg-spinners:pulse-3 size-6" />
  {:then accountInfo}
    {#if accountInfo !== null}
      <ul>
        {#each accountInfo.deposits as deposit (deposit[0])}
          <li>
            <Deposit {deposit} />
          </li>
        {/each}
      </ul>
    {:else}
      <div>No Coin Held</div>
    {/if}
  {/await}
</div>
