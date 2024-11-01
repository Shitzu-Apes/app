<script lang="ts">
  import { slide } from "svelte/transition";

  import Near from "$lib/assets/Near.svelte";
  import SHITZU_MC from "$lib/assets/static/shitzu_mc.png";
  import type { Meme } from "$lib/models/memecooking";
  import { wallet } from "$lib/near";
  import {
    mcAccount$,
    MemeCooking,
    updateMcAccount,
    type McAccount,
  } from "$lib/near/memecooking";
  import { fetchBlockHeight } from "$lib/near/rpc";
  import { FixedNumber } from "$lib/util";

  export let meme: Meme;

  let depositAmount: FixedNumber | null = null;
  const { accountId$ } = wallet;

  $: if ($mcAccount$ && meme) {
    updateDepositAmount($mcAccount$, meme);
  } else {
    depositAmount = null;
  }
  async function updateDepositAmount(
    a: Promise<McAccount | undefined>,
    meme: Meme,
  ) {
    const account = await a;
    if (!account) return;
    const depositedMeme = account.deposits.find(
      ({ meme_id }) => meme_id === meme.meme_id,
    );
    if (!depositedMeme) return;
    depositAmount = new FixedNumber(depositedMeme.amount, 24);
  }

  async function withdraw() {
    if (!depositAmount || depositAmount.valueOf() <= 0n) return;

    try {
      await MemeCooking.claim(
        wallet,
        {
          meme,
          isWithdraw: true,
          unwrapNear: true,
          unwrapAmount: depositAmount.toU128(),
        },
        {
          onSuccess: async (outcome) => {
            if (!outcome || !$accountId$) return;
            depositAmount = new FixedNumber(0n, meme.decimals);
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

{#if depositAmount && depositAmount.valueOf() > 0n && meme.end_timestamp_ms != null && meme.end_timestamp_ms < Date.now()}
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
            Withdraw {depositAmount.format({
              notation: "compact",
            })}
            <Near className="size-5 bg-white rounded-full text-black" />
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
