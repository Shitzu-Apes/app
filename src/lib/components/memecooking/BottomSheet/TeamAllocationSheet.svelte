<script lang="ts">
  import { onMount } from "svelte";
  import { get } from "svelte/store";

  import type { Meme } from "$lib/api/client";
  import { Button } from "$lib/components";
  import VestingChart from "$lib/components/VestingChart.svelte";
  import { BottomSheetContent } from "$lib/layout/BottomSheet";
  import { closeBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import type { MemeInfo } from "$lib/models/memecooking";
  import { MemeCooking } from "$lib/near/memecooking";
  import { wallet } from "$lib/near/wallet";
  import { FixedNumber } from "$lib/util";

  export let meme: Meme & {
    team_allocation_num: number;
    vesting_duration_ms: number;
    cliff_duration_ms: number;
    end_timestamp_ms: number;
  };
  let memeOnchain: MemeInfo | null = null;
  let claimable = 0n;
  let claimed = 0n;
  let loading = true;
  let error: string | null = null;
  let updateInterval: number | null = null;

  async function loadData() {
    try {
      const accountId = get(wallet.accountId$);
      if (!accountId) {
        error = "Please connect wallet first";
        return;
      }

      memeOnchain = await MemeCooking.getFinalizedMeme(meme.meme_id).catch(
        (...args) => {
          console.error("Failed to load meme", args);
          return null;
        },
      );
      if (!memeOnchain) {
        error = "Meme not found";
        return;
      }

      if (!meme.team_allocation) {
        error = "No team allocation for this meme";
        return;
      }

      claimed = BigInt(memeOnchain?.vesting?.already_claimed || "0");

      if (Date.now() < meme.end_timestamp_ms + meme.cliff_duration_ms) {
        claimable = 0n;
      } else if (meme.vesting_duration_ms === 0) {
        claimable = BigInt(meme.team_allocation) - claimed;
      } else if (
        Date.now() >=
        meme.end_timestamp_ms +
          meme.cliff_duration_ms +
          meme.vesting_duration_ms
      ) {
        claimable = BigInt(meme.team_allocation) - claimed;
      } else {
        claimable =
          BigInt(
            meme.team_allocation_num *
              Math.min(
                1,
                (Date.now() -
                  (meme.end_timestamp_ms + meme.cliff_duration_ms)) /
                  meme.vesting_duration_ms,
              ),
          ) - claimed;
      }

      loading = false;
    } catch (e) {
      error = "Failed to load vesting data";
      console.error("Failed to load vesting data", e);
    }
  }

  async function handleClaim() {
    if (!meme || !claimable) return;

    await MemeCooking.claimVesting(
      wallet,
      { meme },
      {
        onSuccess: () => {
          loadData(); // Refresh data after successful claim
        },
      },
    );
  }

  onMount(() => {
    loadData();

    // Set up interval to update vesting if not fully vested
    const endTime =
      meme.end_timestamp_ms + meme.cliff_duration_ms + meme.vesting_duration_ms;
    if (Date.now() < endTime) {
      updateInterval = setInterval(() => {
        if (meme.team_allocation) {
          if (Date.now() < meme.end_timestamp_ms + meme.cliff_duration_ms) {
            claimable = 0n;
          } else if (meme.vesting_duration_ms === 0) {
            claimable = BigInt(meme.team_allocation) - claimed;
          } else if (
            Date.now() >=
            meme.end_timestamp_ms +
              meme.cliff_duration_ms +
              meme.vesting_duration_ms
          ) {
            claimable = BigInt(meme.team_allocation) - claimed;
          } else {
            claimable =
              BigInt(
                meme.team_allocation_num *
                  Math.min(
                    1,
                    (Date.now() -
                      (meme.end_timestamp_ms + meme.cliff_duration_ms)) /
                      meme.vesting_duration_ms,
                  ),
              ) - claimed;
          }
        }
      }, 1000) as unknown as number; // Update every 1 second
    }

    return () => {
      if (updateInterval) {
        clearInterval(updateInterval);
      }
    };
  });

  $: teamAllocation = {
    allocationBps: (meme.team_allocation_num / meme.total_supply_num) * 10000,
    vestingDurationMs: meme.vesting_duration_ms,
    cliffDurationMs: meme.cliff_duration_ms,
  };

  $: claimableAmount = claimable
    ? new FixedNumber(claimable, meme?.decimals || 0).format()
    : "0";
  $: claimedAmount = new FixedNumber(claimed, meme?.decimals || 0).format();
  $: vestedAmount = new FixedNumber(
    BigInt(meme.team_allocation ?? "0") - claimed - claimable,
    meme?.decimals || 0,
  ).format();
</script>

<BottomSheetContent variant="shitzu">
  <slot slot="header">
    <div class="px-4 py-3 border-b border-gray-700">
      <h2 class="text-2xl font-bold text-shitzu-4">Team Allocation</h2>
    </div>
  </slot>

  <section class="text-white px-4 py-6">
    {#if loading}
      <div class="flex justify-center items-center h-40">
        <p class="text-gray-400">Loading allocation details...</p>
      </div>
    {:else if error}
      <div class="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
        <p class="text-red-400">{error}</p>
      </div>
    {:else if teamAllocation}
      <div class="space-y-8">
        <!-- Vesting Schedule Chart -->
        <div class="bg-gray-800/50 rounded-lg p-4">
          <h3 class="text-lg font-medium text-shitzu-4 mb-4">
            Vesting Schedule
          </h3>
          <VestingChart {teamAllocation} />
        </div>

        <!-- Allocation Stats -->
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-gray-800/50 rounded-lg p-4">
            <h4 class="text-sm text-gray-400">Total Allocation</h4>
            <p class="text-xl font-medium text-shitzu-4 mt-1">
              {(teamAllocation.allocationBps / 100).toFixed(2)}%
            </p>
            <p class="text-sm text-gray-400 mt-1">
              {new FixedNumber(
                BigInt(meme.team_allocation_num),
                meme?.decimals || 0,
              ).format()}
            </p>
          </div>

          <div class="bg-gray-800/50 rounded-lg p-4">
            <h4 class="text-sm text-gray-400">Tokens Claimed</h4>
            <p class="text-xl font-medium text-shitzu-4 mt-1">
              {claimedAmount}
            </p>
          </div>
        </div>

        <!-- Claimable Section -->
        {#if claimable && Number(claimable) > 0}
          <div class="bg-shitzu-4/10 rounded-lg p-4">
            <div class="flex justify-between items-center mb-4">
              <div>
                <h4 class="text-sm text-gray-400">Available to Claim</h4>
                <p class="text-xl font-medium text-shitzu-4 mt-1">
                  {claimableAmount}
                </p>
                <p class="text-sm text-gray-400 mt-1">
                  {vestedAmount} vested
                </p>
              </div>
              <Button
                type="custom"
                class="bg-shitzu-4 text-black py-2 px-6 rounded-lg font-medium hover:bg-shitzu-5 transition-colors leading-6"
                onClick={handleClaim}
              >
                Claim
                <img
                  src="{import.meta.env.VITE_IPFS_GATEWAY}/{meme.image}"
                  alt="token"
                  class="size-6 bg-white rounded-full text-black ml-1 inline-block"
                />
              </Button>
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <div class="flex justify-center items-center h-40">
        <p class="text-gray-400">No team allocation configured for this meme</p>
      </div>
    {/if}
  </section>

  <div class="px-4 py-3 border-t border-gray-700">
    <button
      class="w-full text-gray-400 hover:text-white transition-colors text-sm"
      on:click={closeBottomSheet}
    >
      Close
    </button>
  </div>
</BottomSheetContent>
