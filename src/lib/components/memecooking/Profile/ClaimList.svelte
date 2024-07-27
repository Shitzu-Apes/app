<script lang="ts">
  import Claim from "./Claim.svelte";

  import type { Meme } from "$lib/api/client";

  export let claims: {
    token_id: string;
    amount: string;
    meme: Meme | undefined;
  }[];
</script>

<div class="my-6 w-full">
  {#if claims.length > 0}
    <ul class="w-full flex flex-col gap-4 justify-center items-center">
      {#each claims as claim, index (claim.meme ? claim.meme.meme_id : `index-${index}`)}
        <li class="w-full">
          <Claim {claim} />
        </li>
      {/each}
    </ul>
  {:else}
    <div>No Coin Held</div>
  {/if}
</div>
