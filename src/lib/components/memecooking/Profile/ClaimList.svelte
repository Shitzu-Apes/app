<script lang="ts">
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";
  import { slide } from "svelte/transition";

  import MemePreview from "../Board/Desktop/MemePreview.svelte";

  import type { Meme } from "$lib/api/client";
  import { requiredStake } from "$lib/near";

  export let claims: {
    token_id: string;
    amount: string;
    meme: Meme;
  }[];
  export let update: (
    outcome: FinalExecutionOutcome | FinalExecutionOutcome[] | undefined,
  ) => void;

  claims.sort((a, b) => {
    if (!a.meme?.created_timestamp_ms || !b.meme?.created_timestamp_ms) {
      return 0;
    }

    return (
      new Date(b.meme?.created_timestamp_ms).getTime() -
      new Date(a.meme?.created_timestamp_ms).getTime()
    );
  });
</script>

<div class="my-6 w-full">
  {#if claims.length > 0}
    <ul class="w-full flex flex-col gap-4 justify-center items-center">
      {#await requiredStake}
        <div transition:slide class="i-svg-spinners:pulse-3 size-40" />
      {:then requiredStake}
        {#each claims as claim, index (claim.meme ? claim.meme.meme_id : `index-${index}`)}
          <MemePreview
            memebid={claim.meme}
            {requiredStake}
            claimAmount={claim.amount}
            {update}
          />
        {/each}
      {/await}
    </ul>
  {:else}
    <div>No Coin Held</div>
  {/if}
</div>
