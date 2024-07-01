<script lang="ts">
  import Deposit from "./Deposit.svelte";

  import type { MCAccountInfo } from "$lib/models/memecooking";

  export let accountInfo: Promise<MCAccountInfo | null>;
</script>

{#await accountInfo}
  <div>Loading...</div>
{:then accountInfo}
  {#if accountInfo !== null}
    <ul>
      {#each accountInfo.deposits as deposit (deposit[0])}
        <li>
          <Deposit {deposit} />
        </li>
      {/each}
    </ul>
  {/if}
{/await}
