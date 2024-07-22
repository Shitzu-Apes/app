<script lang="ts">
  import Claim from "./Claim.svelte";

  import type { MCAccountInfo } from "$lib/models/memecooking";

  export let claims: MCAccountInfo["claims"];
</script>

<div class="my-6">
  {#if claims.length > 0}
    <ul class="flex flex-col gap-2 justify-center items-center">
      {#each claims as claim (claim[0])}
        <li>
          <Claim {claim} />
        </li>
      {/each}
    </ul>
  {:else}
    <div>No Coin Held</div>
  {/if}
</div>
