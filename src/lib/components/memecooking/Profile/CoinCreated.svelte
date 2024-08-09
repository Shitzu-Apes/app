<script lang="ts">
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";
  import { slide } from "svelte/transition";

  import MemePreview from "../Board/Desktop/MemePreview.svelte";

  import type { Meme } from "$lib/api/client";
  import { requiredStake } from "$lib/near";

  export let coins: Meme[] | undefined;
  export let update: (
    outcome: FinalExecutionOutcome | FinalExecutionOutcome[] | undefined,
  ) => void;

  // sort by created time
  $: coins = coins?.sort(
    (a, b) => b.created_timestamp_ms - a.created_timestamp_ms,
  );
</script>

<div class="my-6">
  {#if coins && coins.length > 0}
    <ul class="flex flex-col gap-2 justify-center items-center">
      {#await requiredStake}
        <div transition:slide class="i-svg-spinners:pulse-3 size-40" />
      {:then requiredStake}
        {#each coins as claim (claim.meme_id)}
          <MemePreview
            memebid={claim}
            {requiredStake}
            showCook={false}
            {update}
          />
        {/each}
      {/await}
    </ul>
  {:else}
    <div>No Coin Created</div>
  {/if}
</div>
