<script lang="ts">
  import type { MCAccountInfo } from "$lib/models/memecooking";
  import { FixedNumber } from "$lib/util";

  export let accountInfo: Promise<MCAccountInfo>;
</script>

{#await accountInfo}
  <div>Loading...</div>
{:then accountInfo}
  <ul>
    {#each accountInfo.deposits as [id, deposit] (id)}
      <li>
        {id}: {new FixedNumber(deposit, 24).format()}

        <button>[withdraw]</button>
      </li>
    {/each}
  </ul>
{/await}
