<script lang="ts">
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";
  import { slide } from "svelte/transition";

  import MemePreview from "../Board/Desktop/MemePreview.svelte";

  import type { Meme } from "$lib/api/client";
  import { requiredStake } from "$lib/near/memecooking";

  export let coins: Meme[] | undefined;
  export let isOwnAccount: boolean = false;
  export let update: (
    outcome: FinalExecutionOutcome | FinalExecutionOutcome[] | undefined,
  ) => void;

  // sort by created time
  $: coins = coins?.sort(
    (a, b) => b.created_timestamp_ms - a.created_timestamp_ms,
  );
</script>

<div class="my-6 flex flex-col items-center justify-between">
  {#if coins && coins.length > 0}
    <div class="mt-10 px-1 mb-10">
      <div class="flex flex-wrap gap-4 justify-evenly">
        {#await requiredStake}
          <div transition:slide class="i-svg-spinners:pulse-3 size-40" />
        {:then requiredStake}
          {#each coins as coin (coin.meme_id)}
            <div class="w-full sm:w-[calc(50%-16px)] lg:w-[calc(33%-16px)]">
              <MemePreview
                memebid={coin}
                {requiredStake}
                showCook={false}
                {isOwnAccount}
                {update}
              />
            </div>
          {/each}
        {/await}
      </div>
    </div>
  {:else}
    <div>No Token Created</div>
  {/if}
</div>
