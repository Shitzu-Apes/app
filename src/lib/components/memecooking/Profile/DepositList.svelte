<script lang="ts">
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";
  import { slide } from "svelte/transition";

  import MemePreview from "../Board/Desktop/MemePreview.svelte";

  import type { Meme } from "$lib/api/client";
  import { requiredStake } from "$lib/near/memecooking";

  export let deposits: {
    meme_id: number;
    amount: string;
    meme: Meme;
  }[];
  export let update: (
    outcome: FinalExecutionOutcome | FinalExecutionOutcome[] | undefined,
  ) => void;

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
      {#await requiredStake}
        <div transition:slide class="i-svg-spinners:pulse-3 size-40" />
      {:then requiredStake}
        {#each deposits as deposit, index (deposit.meme_id || `index-${index}`)}
          <MemePreview
            memebid={deposit.meme}
            {requiredStake}
            depositAmount={deposit.amount}
            {update}
          />
        {/each}
      {/await}
    </ul>
  {:else}
    <div>No Token Held</div>
  {/if}
</div>
