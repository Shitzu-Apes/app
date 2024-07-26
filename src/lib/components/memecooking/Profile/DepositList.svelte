<script lang="ts">
  import Deposit from "./Deposit.svelte";

  import type { Meme } from "$lib/api/client";

  export let deposits: {
    meme_id: string;
    amount: string;
    meme: Meme | undefined;
  }[];
</script>

<div class="my-6">
  {#if deposits.length > 0}
    <ul class="flex flex-col gap-2 justify-center items-center">
      {#each deposits as deposit, index (deposit.meme_id || `index-${index}`)}
        <li class="w-full max-w-xl">
          <Deposit {deposit} />
        </li>
      {/each}
    </ul>
  {:else}
    <div>No Coin Held</div>
  {/if}
</div>
