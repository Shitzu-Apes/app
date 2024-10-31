<script lang="ts">
  import { slide } from "svelte/transition";

  import type { Meme } from "$lib/models/memecooking";
  import { wallet } from "$lib/near";
  import { MemeCooking, updateMcAccount } from "$lib/near/memecooking";
  import { fetchBlockHeight } from "$lib/near/rpc";
  import { FixedNumber } from "$lib/util";

  export let meme: Meme;

  let claimAmount: FixedNumber | null = null;
  const { accountId$ } = wallet;

  $: if ($accountId$) {
    MemeCooking.getClaimable($accountId$, meme.meme_id).then((amount) => {
      if (amount !== null) {
        claimAmount = new FixedNumber(amount, meme.decimals);
      }
    });
  } else {
    claimAmount = null;
  }

  async function claim() {
    if (!claimAmount || claimAmount.valueOf() <= 0n) return;

    try {
      await MemeCooking.claim(
        wallet,
        {
          meme,
        },
        {
          onSuccess: async (outcome) => {
            if (!outcome || !$accountId$) return;
            claimAmount = new FixedNumber(0n, meme.decimals);
            const blockHeight = (await fetchBlockHeight(outcome)) + 3;
            updateMcAccount($accountId$, true, blockHeight);
          },
        },
      );
    } catch (e) {
      console.error("Claim failed:", e);
    }
  }
</script>

{#if claimAmount && claimAmount.valueOf() > 0n}
  <div
    out:slide
    class="bg-shitzu-4 rounded-md p-4 mb-4 flex flex-col justify-between items-stretch gap-4"
  >
    <p class="text-gray-8 text-center sm:text-left">
      <span class="text-xl text-center"
        >{claimAmount.format({
          compactDisplay: "short",
          notation: "compact",
        })}
        {meme.symbol}</span
      >
    </p>
    <button
      on:click={claim}
      class="bg-gray-1 hover:bg-memecooking-1 text-black font-bold py-2 px-4 rounded transition duration-300 ease-in-out w-full sm:w-auto"
    >
      [Claim Now]
    </button>
  </div>
{/if}
