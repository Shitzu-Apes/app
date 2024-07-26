<script lang="ts">
  import Claim from "./Claim.svelte";

  import type { Meme } from "$lib/api/client";

  export let claims: {
    token_id: string;
    amount: string;
    meme: Meme | undefined;
  }[];
</script>

<div class="my-6">
  {#if claims.length > 0}
    <ul class="flex flex-col gap-2 justify-center items-center">
      {#each claims as claim, index (claim.meme ? claim.meme.meme_id : `index-${index}`)}
        <li class="w-full max-w-xl">
          <Claim {claim} />
        </li>
      {/each}
    </ul>
  {:else}
    <div>No Coin Held</div>
  {/if}
</div>
