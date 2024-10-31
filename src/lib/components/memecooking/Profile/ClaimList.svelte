<script lang="ts">
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";
  import { slide } from "svelte/transition";

  import MemePreview from "../Board/Desktop/MemePreview.svelte";

  import type { Meme } from "$lib/api/client";
  import { requiredStake } from "$lib/near/memecooking";
  import type { FixedNumber } from "$lib/util";

  export let claims: {
    token_id: string;
    amount: FixedNumber;
    meme: Meme;
  }[];
  export let isOwnAccount: boolean = false;
  export let update: (
    outcome: FinalExecutionOutcome | FinalExecutionOutcome[] | undefined,
  ) => void;
</script>

<div class="my-6 w-full">
  {#if claims.length > 0}
    <div class="mt-10 px-1 mb-10">
      <div class="flex flex-wrap gap-4 justify-evenly">
        {#await requiredStake}
          <div transition:slide class="i-svg-spinners:pulse-3 size-40" />
        {:then requiredStake}
          {#each claims as claim, index (claim.meme ? claim.meme.meme_id : `index-${index}`)}
            <div class="w-full sm:w-[calc(50%-16px)] lg:w-[calc(33%-16px)]">
              <MemePreview
                memebid={claim.meme}
                {requiredStake}
                claimAmount={claim.amount}
                {isOwnAccount}
                {update}
              />
            </div>
          {/each}
        {/await}
      </div>
    </div>
  {:else}
    <div>No Token Held</div>
  {/if}
</div>
