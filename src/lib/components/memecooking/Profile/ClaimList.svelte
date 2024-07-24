<script lang="ts">
  import Claim from "./Claim.svelte";

  import type { paths } from "$lib/api/openapi";

  export let claims: paths["/profile/{accountId}"]["get"]["responses"]["200"]["content"]["application/json"]["coins_held"];
</script>

<div class="my-6">
  {#if claims.length > 0}
    <ul class="flex flex-col gap-2 justify-center items-center">
      {#each claims as claim (claim.meme_id)}
        <li>
          <Claim {claim} />
        </li>
      {/each}
    </ul>
  {:else}
    <div>No Coin Held</div>
  {/if}
</div>
