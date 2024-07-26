<script lang="ts">
  import Countdown from "../Countdown.svelte";

  import type { Meme } from "$lib/api/client";
  import Near from "$lib/assets/Near.svelte";
  import { MemeCooking, wallet } from "$lib/near";
  import { FixedNumber } from "$lib/util";

  export let deposit: {
    meme_id: string;
    amount: string;
    meme: Meme | undefined;
  };

  async function withdraw() {
    try {
      await MemeCooking.withdraw(wallet, {
        memeId: +deposit.meme_id,
        amount: deposit.amount,
      });
    } catch (e) {
      console.error(e);
    }
  }
</script>

<div class="flex gap-4 items-start max-w-xl">
  {#if deposit.meme?.image}
    <img
      src="{import.meta.env.VITE_IPFS_GATEWAY}/{deposit.meme?.image}"
      alt="{deposit.meme?.name} icon"
      class="rounded-lg w-24"
    />
  {:else}
    <div class="size-24 bg-gray-200 rounded-lg" />
  {/if}

  <div class="flex flex-col flex-1">
    <div class="flex flex-col">
      <h4 class="text-md font-normal">
        {deposit.meme ? deposit.meme.name : "N/A"}
      </h4>
      <h3 class="text-base font-semibold">
        ({deposit.meme ? deposit.meme.symbol : "N/A"})
      </h3>
    </div>
    <div>
      <Countdown to={deposit.meme?.end_timestamp_ms || 0} />
    </div>
    <div class="flex items-center gap-1">
      <Near className="size-4" />
      {new FixedNumber(deposit.amount, 24).format()}
    </div>
    <button class="" on:click={withdraw}>[withdraw]</button>
  </div>
</div>
