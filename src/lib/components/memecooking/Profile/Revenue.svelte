<script lang="ts">
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";

  import RevenueShare from "../BottomSheet/RevenueShare.svelte";
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
  export let referralFees: FixedNumber | null = null;
  export let withdrawFees: FixedNumber | null = null;

  export let update: (
    outcome: FinalExecutionOutcome | FinalExecutionOutcome[] | undefined,
  ) => void;

  export let isOwnAccount: boolean;

  let hasRevenue = revenue && revenue.length > 0;

  let amount = hasRevenue ? revenue![0].amount : "0";

  const { accountId$ } = wallet;

  async function claim() {
    if (!hasRevenue) {
      return;
    }
    MemeCooking.claimIncome(
      wallet,
      {
        token_ids: revenue!.map((r) => r.token_id),
      },
      { onSuccess: update },
    );
  }
</script>

<div class="my-10 w-[350px] p-5 bg-shitzu-5/90 rounded-lg shadow-md">
  <h2
    class="text-2xl font-bold text-gray-100 mb-5 flex items-center justify-between"
  >
    Revenue Earned
    <button
      class="i-mdi:information-outline text-lg"
      on:click={() => openBottomSheet(RevenueShare)}
      aria-label="Revenue information"
    />
  </h2>

  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between text-white">
      <Near className="size-6 bg-white rounded-full text-black" />
      <span class="text-sm font-medium">All amounts in NEAR</span>
    </div>

    <div class="space-y-2 text-white">
      {#if referralFees != null}
        <div class="flex justify-between items-center">
          <span class="text-sm">Referral:</span>
          <span class="font-semibold">{referralFees.format()}</span>
        </div>
      {/if}
      {#if withdrawFees != null}
        <div class="flex justify-between items-center">
          <span class="text-sm">Withdrawal:</span>
          <span class="font-semibold">{withdrawFees.format()}</span>
        </div>
      {/if}
    </div>

    {#if referralFees != null && withdrawFees != null}
      <div class="border-t border-white/20 pt-2 mt-2">
        <div class="flex justify-between items-center text-white">
          <span class="text-lg font-bold">Total:</span>
          <span class="text-xl font-bold"
            >{referralFees.add(withdrawFees).format()}</span
          >
        </div>
      </div>
    {/if}

    {#if isOwnAccount}
      <div class="border-t border-white/20 pt-2 mt-2">
        <div class="flex justify-between items-center text-white">
          <span class="text-sm font-medium">Claimable:</span>
          <span class="font-semibold"
            >{new FixedNumber(amount, 24).format()}</span
          >
        </div>
      </div>
    {/if}
  </div>

  {#if isOwnAccount}
    <div class="mt-6 flex justify-between items-center">
      <button
        class="bg-white text-shitzu-5 px-4 py-2 rounded-md text-sm font-semibold transition-colors hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-shitzu-5 disabled:opacity-50 disabled:cursor-not-allowed"
        on:click={claim}
        disabled={!hasRevenue}
      >
        Claim Revenue
      </button>
      <button
        class="text-white text-sm hover:underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white"
        on:click={async () => {
          const shareUrl = new URL(`${window.location.origin}/board`);
          if ($accountId$) {
            shareUrl.searchParams.set("referral", $accountId$);
          }

          if (navigator.share) {
            try {
              await navigator.share({
                title: document.title,
                url: shareUrl.toString(),
              });
            } catch (error) {
              console.error("Error sharing:", error);
            }
          } else {
            try {
              await navigator.clipboard.writeText(shareUrl.toString());
              addToast({
                data: {
                  type: "simple",
                  data: {
                    title: "Success",
                    description: "Referral link copied to clipboard!",
                    color: "green",
                  },
                },
              });
            } catch (error) {
              console.error("Error copying to clipboard:", error);
            }
          }
        }}
      >
        [Share Referral Link]
      </button>
    </div>
  {/if}
</div>
