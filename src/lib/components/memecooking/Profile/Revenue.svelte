<script lang="ts">
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";

  import Near from "$lib/assets/Near.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { wallet } from "$lib/near";
  import { MemeCooking } from "$lib/near/memecooking";
  import { FixedNumber } from "$lib/util";

  export let revenue: {
    token_id: string;
    amount: string;
    meme: Meme | undefined;
  }[];

  export let update: (
    outcome: FinalExecutionOutcome | FinalExecutionOutcome[] | undefined,
  ) => void;

  async function claim() {
    MemeCooking.claimIncome(
      wallet,
      {
        token_ids: revenue.map((r) => r.token_id),
      },
      { onSuccess: update },
    );
  }
</script>

{#each revenue as r}
  {#if !r.meme}
    <div class="my-10 w-[300px] p-5 bg-shitzu-4/90 rounded-lg">
      <h2 class="text-xl font-semibold text-gray-100 mb-5">Revenue Earned</h2>
      <div class="flex justify-between items-end">
        <div class="flex items-center gap-2">
          <Near className="size-8 bg-white rounded-full text-black" />
          <div class="text-white text-xl font-semibold">
            {new FixedNumber(r.amount, 24).format()}
          </div>
        </div>
        <button class="text-white text-sm font-semibold" on:click={claim}>
          Claim
        </button>
      </div>
    </div>
  {/if}
{/each}
