<script lang="ts">
  import { slide } from "svelte/transition";

  import SHITZU_LIKE from "$lib/assets/static/shitzu_like.png";
  import McIcon from "$lib/components/MCIcon.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { nearWallet } from "$lib/near";
  import { MemeCooking, updateMcAccount } from "$lib/near/memecooking";
  import { fetchBlockHeight } from "$lib/near/rpc";
  import { FixedNumber } from "$lib/util";

  export let meme: Meme;

  let claimAmount: FixedNumber | null = null;
  const { accountId$ } = nearWallet;

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
        nearWallet,
        {
          meme,
        },
        {
          onSuccess: async (outcome) => {
            if (!outcome || !$accountId$) return;
            claimAmount = new FixedNumber(0n, meme.decimals);
            const blockHeight = await fetchBlockHeight(outcome);
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
  <div out:slide class="bg-gray-800 rounded-lg p-4 mb-4">
    <div class="grid grid-cols-3 gap-4">
      <div class="flex items-center justify-center">
        <img src={SHITZU_LIKE} class="w-full" alt="Shitzu Like" />
      </div>
      <div class="col-span-2 h-full">
        <div class="flex flex-col gap-6 justify-between h-full p-2">
          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-3">
              <div class="i-mdi:check-circle text-shitzu-3 text-3xl" />
              <h3 class="text-xl font-semibold text-gray-300">
                Launched on Ref
              </h3>
            </div>
          </div>

          <button
            on:click={claim}
            class="px-4 py-2 w-full bg-shitzu-3 text-black hover:brightness-110 transition-colors duration-200 rounded-md flex items-center justify-center gap-2 font-medium shadow-lg hover:shadow-xl"
          >
            Claim {claimAmount.format({
              notation: "compact",
            })}
            <McIcon {meme} class="size-4 bg-white rounded-full text-black" />
            {meme.symbol}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
