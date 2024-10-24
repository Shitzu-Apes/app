<script lang="ts">
  import { slide } from "svelte/transition";

  import Near from "$lib/assets/Near.svelte";
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
          memes: [meme],
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
  <div
    out:slide
    class="bg-shitzu-4 rounded-md p-4 mb-4 flex flex-col justify-between items-stretch gap-4"
  >
    <p class="text-gray-8 text-center sm:text-left">
      Launch failed. Please withdraw your Near
    </p>
    <button
      on:click={withdraw}
      class="bg-gray-1 hover:bg-memecooking-1 text-black font-bold py-2 px-4 rounded transition duration-300 ease-in-out w-full sm:w-auto"
    >
      [withdraw {depositAmount.format({
        compactDisplay: "short",
        notation: "compact",
      })}
      <Near className="size-8 inline" />]
    </button>
  </div>
{/if}
