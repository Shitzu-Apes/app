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

<div class="my-10 w-[300px] p-5 bg-shitzu-4/90 rounded-lg">
  <h2 class="text-xl font-semibold text-gray-100 mb-5">
    Revenue Earned

    <button
      class="i-mdi:information-outline"
      on:click={() => openBottomSheet(RevenueShare)}
    />

    {#if isOwnAccount}
      <button
        class="self-end text-sm hover:underline"
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
                    description: "Link copied to clipboard!",
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
        [copy link]
      </button>
    {/if}
  </h2>
  <div class="flex justify-between items-end">
    <div class="flex items-center gap-2">
      <Near className="size-8 bg-white rounded-full text-black" />

      <div
        class="flex flex-col gap-2 text-white text-lg font-semibold text-shadow-md"
      >
        {#if referralFees != null}
          <div>
            <strong>Referral:</strong>
            {referralFees.format()}
          </div>
        {/if}
        {#if withdrawFees != null}
          <div>
            <strong>Withdrawal:</strong>
            {withdrawFees.format()}
          </div>
        {/if}
        {#if referralFees != null && withdrawFees != null}
          <div>
            <strong>Total:</strong>
            {referralFees.add(withdrawFees).format()}
          </div>
        {/if}
        {#if isOwnAccount}
          <div>
            <strong>Claimable:</strong>
            {new FixedNumber(amount, 24).format()}
          </div>
        {/if}
      </div>
    </div>

    {#if isOwnAccount}
      <button
        class="text-white text-sm font-semibold disabled:opacity-50"
        on:click={claim}
        disabled={!hasRevenue}
      >
        Claim
      </button>
    {/if}
  </div>
</div>
