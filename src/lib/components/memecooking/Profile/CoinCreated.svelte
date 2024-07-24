<script lang="ts">
  import type { paths } from "$lib/api/openapi";

  export let coins: paths["/profile/{accountId}"]["get"]["responses"]["200"]["content"]["application/json"]["coin_created"];
</script>

<div class="my-6">
  {#if coins.length > 0}
    <ul class="flex flex-col gap-2 justify-center items-center">
      {#each coins as claim (claim.meme_id)}
        <li>
          <a
            href={`/meme/${claim.meme_id}`}
            class="flex gap-4 items-start border border-transparent hover:border-white p-2 rounded"
          >
            <img
              src="{import.meta.env.VITE_IPFS_GATEWAY}/{claim.image}"
              alt="{claim.name} icon"
              class="rounded-lg w-24"
            />
            <div class="flex flex-col">
              <div class="">
                <h3 class="text-lg font-bold uppercase">{claim.symbol}</h3>
              </div>
              <div class="">
                <h4 class="text-md font-normal">{claim.name}</h4>
              </div>
              <div class="">{claim.description}</div>
            </div>
          </a>
        </li>
      {/each}
    </ul>
  {:else}
    <div>No Coin Created</div>
  {/if}
</div>
