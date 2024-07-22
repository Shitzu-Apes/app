<script lang="ts">
  import Deposit from "./Deposit.svelte";

  import type { MCAccountInfo } from "$lib/models/memecooking";

  export let deposits: MCAccountInfo["deposits"];
</script>

<div class="my-6">
  {#if deposits.length > 0}
    <ul class="flex flex-col gap-2 justify-center items-center">
      {#each deposits as deposit (deposit[0])}
        <li>
          <Deposit {deposit} />
        </li>
      {/each}
    </ul>
  {:else}
    <div>No Coin Held</div>
  {/if}
</div>
