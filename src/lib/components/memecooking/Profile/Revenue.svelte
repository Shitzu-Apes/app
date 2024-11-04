<script lang="ts">
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";

  import { addToast } from "../../Toast.svelte";
  import RevenueShare from "../BottomSheet/RevenueShare.svelte";
  import ShitstarSheet from "../BottomSheet/ShitstarSheet.svelte";

  import Near from "$lib/assets/Near.svelte";
  import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { Rewarder, wallet } from "$lib/near";
  import { MemeCooking } from "$lib/near/memecooking";
  import { FixedNumber } from "$lib/util";

  export let revenue:
    | {
        token_id: string;
        amount: string;
        meme: Meme | undefined;
      }[]
    | null = null;
  export let shitstarClaim: FixedNumber | null = null;
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
    const accountId = $accountId$;
    if (!accountId) {
      addToast({
        data: {
          type: "simple",
          data: {
            title: "Error",
            description: "Please connect your wallet",
            color: "red",
          },
        },
      });
      return;
    }
    const hasNft = (await Rewarder.primaryNftOf(accountId)) != null;
    const hasShitstarClaim =
      hasNft && shitstarClaim != null && shitstarClaim.valueOf() > 0n;
    if (!hasRevenue && !hasShitstarClaim) {
      if ((shitstarClaim?.valueOf() ?? 0n) > 0n && !hasNft) {
        addToast({
          data: {
            type: "simple",
            data: {
              title: "Error",
              description:
                "You have pending claimable Shitstars, but did not yet stake an NFT",
              color: "red",
            },
          },
        });
      } else {
        addToast({
          data: {
            type: "simple",
            data: {
              title: "Error",
              description: "Nothing to claim",
              color: "red",
            },
          },
        });
      }
      return;
    }
    MemeCooking.claimIncome(
      wallet,
      {
        token_ids: revenue!.map((r) => r.token_id),
      },
      !!hasRevenue,
      hasShitstarClaim,
      { onSuccess: update },
    );
  }
</script>

<div class="flex flex-col w-full gap-4 bg-gray-800 p-5 rounded-lg">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <h2 class="text-2xl font-medium">Revenue Earned</h2>
    <button
      class="p-1 hover:bg-gray-700 rounded"
      on:click={() => openBottomSheet(RevenueShare)}
      aria-label="Revenue information"
    >
      <div class="i-mdi:information-outline text-lg" />
    </button>
  </div>

  <!-- Currency Note -->
  <div class="flex items-center gap-2 text-gray-400">
    <Near className="size-5 bg-white rounded-full text-black" />
    <span class="text-sm">All amounts in NEAR</span>
  </div>

  <!-- Revenue Breakdown -->
  <div class="flex flex-col gap-4">
    {#if referralFees != null}
      <div class="flex items-center gap-1">
        <span class="w-6 flex justify-center flex-shrink-0">
          <div class="i-mdi:account-multiple text-memecooking-400" />
        </span>
        <span class="text-memecooking-400 text-sm font-medium">Referral:</span>
        <span class="font-medium ml-auto">{referralFees.format()}</span>
      </div>
    {/if}

    {#if withdrawFees != null}
      <div class="flex items-center gap-1">
        <span class="w-6 flex justify-center flex-shrink-0">
          <div class="i-mdi:cash text-memecooking-400" />
        </span>
        <span class="text-memecooking-400 text-sm font-medium">Withdrawal:</span
        >
        <span class="font-medium ml-auto">{withdrawFees.format()}</span>
      </div>
    {/if}

    {#if referralFees != null && withdrawFees != null}
      <div class="flex items-center gap-1 border-t border-gray-700 pt-4">
        <span class="w-6 flex justify-center flex-shrink-0">
          <div class="i-mdi:calculator text-memecooking-400" />
        </span>
        <span class="text-memecooking-400 text-sm font-medium">Total:</span>
        <span class="font-medium ml-auto"
          >{referralFees.add(withdrawFees).format()}</span
        >
      </div>
    {/if}

    {#if isOwnAccount}
      <div class="flex flex-col gap-2 border-t border-gray-700 pt-4">
        <div class="flex items-center gap-1">
          <span class="w-6 flex justify-center flex-shrink-0">
            <div class="i-mdi:wallet text-memecooking-400" />
          </span>
          <span class="text-memecooking-400 text-sm font-medium"
            >Claimable:</span
          >
          <span class="font-medium ml-auto"
            >{new FixedNumber(amount, 24).format()}</span
          >
        </div>

        <div class="flex items-center gap-1">
          <span class="w-6 flex justify-center flex-shrink-0">
            <div class="i-mdi:star text-memecooking-400" />
          </span>
          <span
            class="text-memecooking-400 text-sm font-medium flex items-center gap-1"
          >
            Shitstars
            <button
              class="p-1 hover:bg-gray-700 rounded"
              on:click={() => openBottomSheet(ShitstarSheet)}
              aria-label="Shitstar information"
            >
              <div class="i-mdi:information-outline text-sm" />
            </button>
          </span>
          <span class="font-medium ml-auto">
            {#if shitstarClaim != null && shitstarClaim.valueOf() > 0}
              {shitstarClaim.format()}
            {:else}
              0
            {/if}
          </span>
        </div>
      </div>
    {/if}
  </div>

  {#if isOwnAccount}
    <div class="flex items-center justify-between gap-4 mt-2">
      <button
        class="flex-1 bg-memecooking-400 text-black py-2 rounded font-medium hover:bg-memecooking-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        on:click={claim}
      >
        Claim Revenue
      </button>
    </div>
  {/if}
</div>
