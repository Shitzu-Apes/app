<script lang="ts">
  import type { Meme } from "$lib/api/client";
  import Near from "$lib/assets/Near.svelte";
  import { MemeCooking, wallet } from "$lib/near";
  import { FixedNumber } from "$lib/util";

  export let claim: {
    token_id: string;
    amount: string;
    meme: Meme | undefined;
  };

  async function claiming() {
    try {
      await MemeCooking.claim(wallet, {
        token_ids: [claim.token_id],
      });
    } catch (e) {
      console.error(e);
    }
  }
</script>

{#if claim.token_id === import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID}
  <div class="w-full flex gap-4 items-start max-w-xl">
    <div class="rounded-lg w-24 bg-white">
      <Near className="size-24 text-black" />
    </div>
    <div class="flex flex-col flex-1">
      <div class="">
        <h3 class="text-lg font-bold uppercase">wNEAR</h3>
      </div>
      <div class="">
        <h4 class="text-md font-normal">Wrapped NEAR</h4>
      </div>
      <div class="flex items-center gap-1">
        <Near className="size-4 text-black bg-white rounded-full" />
        {new FixedNumber(claim.amount, 24).format()}
      </div>
      <button class="" on:click={claiming}>[claim]</button>
    </div>
  </div>
{:else}
  <div class="w-full flex gap-4 items-start max-w-xl">
    {#if claim.meme?.image}
      <img
        src="{import.meta.env.VITE_IPFS_GATEWAY}/{claim.meme.image}"
        alt="{claim.meme.name} icon"
        class="rounded-lg w-24"
      />
    {:else}
      <div class="rounded-lg w-24 bg-gray-200"></div>
    {/if}
    <div class="flex flex-col flex-1">
      <div class="">
        <h3 class="text-lg font-bold uppercase">
          {claim.meme ? claim.meme.symbol : "N/A"}
        </h3>
      </div>
      <div class="">
        <h4 class="text-md font-normal">
          {claim.meme ? claim.meme.name : "N/A"}
        </h4>
      </div>
      <div class="flex items-center gap-1">
        {#if claim.meme?.image}
          <img
            src="{import.meta.env.VITE_IPFS_GATEWAY}/{claim.meme?.image}"
            alt="icon"
            class="size-4"
          />
        {:else}
          <div class="size-4 bg-gray-200"></div>
        {/if}
        {new FixedNumber(claim.amount, 24).format()}
      </div>
      <button class="" on:click={claiming}>[claim]</button>
    </div>
  </div>
{/if}
