<script lang="ts">
  import Deposit from "./Deposit.svelte";

  import type { Meme } from "$lib/api/client";

  export let deposits: {
    meme_id: string;
    amount: string;
    meme: Meme | undefined;
  }[];

  deposits.sort((a, b) => {
    // ended_timestamp_ms doesn't exist or ended_timestamp_ms has already passed then it should be at the end of the list
    if (!a.meme?.end_timestamp_ms || a.meme?.end_timestamp_ms < Date.now()) {
      return 1;
    }
    if (!b.meme?.end_timestamp_ms || b.meme?.end_timestamp_ms < Date.now()) {
      return -1;
    }

    // otherwise sort by ended_timestamp_ms
    return (
      new Date(a.meme?.end_timestamp_ms || 0).getTime() -
      new Date(b.meme?.end_timestamp_ms || 0).getTime()
    );
  });
</script>

<div class="my-6 w-full">
  {#if deposits.length > 0}
    <ul class="w-full flex flex-col gap-4 justify-center items-center">
      {#each deposits as deposit, index (deposit.meme_id || `index-${index}`)}
        <li class="w-full">
          <Deposit {deposit} />
        </li>
      {/each}
    </ul>
  {:else}
    <div>No Coin Held</div>
  {/if}
</div>
