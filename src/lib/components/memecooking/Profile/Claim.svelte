<script lang="ts">
  import type { Meme } from "$lib/api/client";
  import Near from "$lib/assets/Near.svelte";
  import { MemeCooking, wallet } from "$lib/near";
  import { FixedNumber } from "$lib/util";
  import { getTokenId } from "$lib/util/getTokenId";

  export let claim: {
    token_id: string;
    amount: string;
    meme: Meme | undefined;
  };

  async function claiming() {
    try {
      if (!claim.meme) return;
      await MemeCooking.claim(wallet, {
        meme_ids: [claim.meme.meme_id],
        token_ids: [getTokenId(claim.meme.symbol, claim.meme.meme_id)],
      });
    } catch (e) {
      console.error(e);
    }
  }
</script>

<div class="w-full flex gap-4 items-start">
  {#if claim.token_id === import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID}
    <div class="rounded-lg w-24 bg-white">
      <Near className="size-24 text-black" />
    </div>
    <div class="flex flex-col flex-1">
      <div class="flex flex-col">
        <h3 class="text-lg font-semibold">wNEAR</h3>
        <h4 class="text-xs font-normal">Wrapped NEAR</h4>
      </div>
      <div class="flex items-center gap-1 mt-auto">
        <Near className="size-4 text-black bg-white" />
        {new FixedNumber(claim.amount, 24).format()}
      </div>
    </div>

    <div class="ml-auto flex flex-col justify-end items-end">
      <a href={`/meme/${claim.meme?.meme_id}`} class="hover:underline">
        [view]
      </a>
      <button class="hover:underline" on:click={claiming}>[claim]</button>
    </div>
  {:else}
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
      <div class="flex flex-col">
        <h3 class="text-lg font-semibold">
          {claim.meme ? claim.meme.symbol : "N/A"}
        </h3>
        <h4 class="text-xs font-normal">
          {claim.meme ? claim.meme.name : "N/A"}
        </h4>
      </div>
      <div class="flex items-center gap-1 mt-auto">
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
    </div>

    <div class="ml-auto flex flex-col justify-end items-end">
      <a href={`/meme/${claim.meme?.meme_id}`} class="hover:underline">
        [view]
      </a>
      <button class="hover:underline" on:click={claiming}>[claim]</button>
    </div>
  {/if}
</div>
