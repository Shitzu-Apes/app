<script lang="ts">
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";

  import HowItWorkSheet from "../BottomSheet/HowItWorkSheet.svelte";
  import { addToast } from "../Toast.svelte";

  import Near from "$lib/assets/Near.svelte";
  import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { wallet } from "$lib/near";
  import { MemeCooking } from "$lib/near/memecooking";
  import { FixedNumber } from "$lib/util";

  export let revenue:
    | {
        token_id: string;
        amount: string;
        meme: Meme | undefined;
      }[]
    | null = null;

  export let update: (
    outcome: FinalExecutionOutcome | FinalExecutionOutcome[] | undefined,
  ) => void;

  let hasRevenue = revenue && revenue.length > 0;

  let amount = hasRevenue ? revenue![0].amount : "0";

  async function claim() {
    if (!hasRevenue) {
      return addToast({
        data: {
          type: "simple",
          data: {
            title: "No revenue to claim",
            description: "You have no revenue to claim",
            color: "red",
          },
        },
      });
    }
    MemeCooking.claimIncome(
      wallet,
      {
        token_ids: revenue!.map((r) => r.token_id),
      },
      { onSuccess: update },
    );
  }

  function howToEarn() {
    openBottomSheet(HowItWorkSheet);
  }
</script>

<div class="my-10 w-[300px] p-5 bg-shitzu-4/90 rounded-lg">
  <h2 class="text-xl font-semibold text-gray-100 mb-5">
    {#if hasRevenue}
      Revenue Earned
    {:else}
      No Revenue Earned
      <br />
      <button class="text-sm" on:click={howToEarn}>[How to]</button>
    {/if}
  </h2>
  <div class="flex justify-between items-end">
    <div class="flex items-center gap-2">
      <Near className="size-8 bg-white rounded-full text-black" />
      <div class="text-white text-xl font-semibold">
        {new FixedNumber(amount, 24).format()}
      </div>
    </div>
    <button
      class="text-white text-sm font-semibold disabled:opacity-50"
      on:click={claim}
      disabled={!hasRevenue}
    >
      Claim
    </button>
  </div>
</div>
