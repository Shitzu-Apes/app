<script lang="ts">
  import Deposit from "./Deposit.svelte";

  import type { paths } from "$lib/api/openapi";

  export let deposits: paths["/profile/{accountId}"]["get"]["responses"]["200"]["content"]["application/json"]["virtual_coins"];
</script>

<div class="my-6">
  {#if deposits.length > 0}
    <ul class="flex flex-col gap-2 justify-center items-center">
      {#each deposits as deposit (deposit.meme_id)}
        <li>
          <Deposit {deposit} />
        </li>
      {/each}
    </ul>
  {:else}
    <div>No Coin Held</div>
  {/if}
</div>
