<script lang="ts">
  import { slide } from "svelte/transition";

  import { useMcMemeDepositQuery } from "$lib/api/queries/memecooking";
  import Near from "$lib/assets/Near.svelte";
  import SHITZU_MC from "$lib/assets/static/shitzu_mc.png";
  import type { Meme } from "$lib/models/memecooking";
  import { nearWallet } from "$lib/near";
  import { MemeCooking, updateMcAccount } from "$lib/near/memecooking";
  import { fetchBlockHeight } from "$lib/near/rpc";

  export let meme: Meme;

  const { accountId$ } = nearWallet;

  $: depositQuery = $accountId$
    ? useMcMemeDepositQuery($accountId$, meme.meme_id)
    : null;

  async function withdraw() {
    if (!$depositQuery?.data) return;

    const depositAmount = $depositQuery.data.amount;
    if (depositAmount.valueOf() <= 0n) return;

    try {
      await MemeCooking.claim(
        nearWallet,
        {
          meme,
          isWithdraw: true,
          unwrapNear: true,
          unwrapAmount: depositAmount.toU128(),
        },
        {
          onSuccess: async (outcome) => {
            if (!outcome || !$accountId$) return;
            const blockHeight = await fetchBlockHeight(outcome);
            updateMcAccount($accountId$, blockHeight);
          },
        },
      );
    } catch (e) {
      console.error("Claim failed:", e);
    }
  }
</script>

{#if $depositQuery?.data?.amount && $depositQuery.data.amount.valueOf() > 0n && meme.end_timestamp_ms != null && meme.end_timestamp_ms < Date.now() && meme.total_deposit && meme.soft_cap && BigInt(meme.total_deposit) < BigInt(meme.soft_cap)}
  <div out:slide class="bg-gray-800 rounded-lg p-4 mb-4">
    <div class="grid grid-cols-3 gap-4">
      <div class="flex items-center justify-center">
        <img src={SHITZU_MC} class="w-full" alt="Shitzu Mc" />
      </div>
      <div class="col-span-2 h-full">
        <div class="flex flex-col gap-6 justify-between h-full p-2">
          <div class="flex flex-col gap-3">
            <div class="flex items-center gap-3">
              <div class="i-mdi:alert text-rose-500 text-3xl" />
              <h3 class="text-xl font-semibold text-g-300">Launch Failed</h3>
            </div>
          </div>

          <button
            on:click={withdraw}
            class="px-4 py-2 w-full bg-rose-700 hover:bg-rose-600 transition-colors duration-200 rounded-md flex items-center justify-center gap-2 text-white font-medium shadow-lg hover:shadow-xl"
          >
            Withdraw {$depositQuery.data.amount.format({
              notation: "compact",
            })}
            <Near className="size-5 bg-white rounded-full text-black" />
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
