<script lang="ts">
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";

  import Near from "$lib/assets/Near.svelte";
  import { showWalletSelector } from "$lib/auth";
  import { addToast } from "$lib/components/Toast.svelte";
  import ProgressBarSmall from "$lib/components/memecooking/Board/Desktop/ProgressBarSmall.svelte";
  import ReferralSheet from "$lib/components/memecooking/BottomSheet/ReferralSheet.svelte";
  import Chef from "$lib/components/memecooking/Chef.svelte";
  import Countdown from "$lib/components/memecooking/Countdown.svelte";
  import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { Ref, wallet } from "$lib/near";
  import { Ft } from "$lib/near";
  import { MemeCooking } from "$lib/near/memecooking";
  import { handleBuy } from "$lib/near/swap";
  import { FixedNumber } from "$lib/util";
  import { getTokenId } from "$lib/util/getTokenId";
  import { getReferral } from "$lib/util/referral";

  export let memebid: Meme;
  export let requiredStake: FixedNumber;
  export let showCook = true;
  export let depositAmount: string | undefined = undefined;
  export let isOwnAccount: boolean = false;
  export let claimAmount: FixedNumber | undefined = undefined;
  export let quickActionAmount: string = "5";
  export let update:
    | ((
        outcome: FinalExecutionOutcome | FinalExecutionOutcome[] | undefined,
      ) => void)
    | undefined = undefined;

  const { accountId$ } = wallet;

  $: reachedMcap = new FixedNumber(memebid.total_deposit, 24) >= requiredStake;
  $: isLaunched = memebid.pool_id;
  $: isEnded =
    memebid.end_timestamp_ms && memebid.end_timestamp_ms < Date.now();
  $: status = isLaunched
    ? "live"
    : isEnded
      ? reachedMcap
        ? "pending"
        : "failed"
      : "active";
  $: statusColor = {
    live: "bg-gray-1 text-black",
    pending: "bg-amber-4 text-black",
    failed: "bg-rose-4 text-black",
    active:
      "bg-shitzu-400 text-black animated animated-heart-beat animated-infinite hover:animate-none",
  }[status];

  const { projectedMcap } = memebid;

  async function withdraw(ev: Event) {
    ev.preventDefault();
    if (!memebid.end_timestamp_ms || !depositAmount) return;

    try {
      if (memebid.end_timestamp_ms < Date.now()) {
        await MemeCooking.claim(
          wallet,
          {
            meme: memebid,
            isWithdraw: true,
            unwrapNear: true,
            unwrapAmount: depositAmount,
          },
          { onSuccess: update },
        );
      } else {
        await MemeCooking.withdraw(
          wallet,
          {
            memeId: memebid.meme_id,
            amount: depositAmount,
            unwrapNear: true,
          },
          { onSuccess: update },
        );
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function claim(ev: Event) {
    ev.preventDefault();
    try {
      await MemeCooking.claim(wallet, { meme: memebid }, { onSuccess: update });
    } catch (e) {
      console.error(e);
    }
  }

  async function quickAction(ev: Event) {
    ev.preventDefault();
    if (!$accountId$) {
      showWalletSelector("shitzu");
      return;
    }

    if (isLaunched && memebid.pool_id) {
      // Buy action
      const input = new FixedNumber(
        BigInt(Number(quickActionAmount) * 1e24),
        24,
      );

      const expected = await Ref.getReturn({
        amountIn: input,
        tokenOut: getTokenId(memebid.symbol, memebid.meme_id),
        tokenIn: import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID,
        poolId: memebid.pool_id,
        decimals: memebid.decimals,
      });

      await handleBuy(input, $accountId$, expected, memebid);
    } else {
      // Deposit action
      try {
        const input = new FixedNumber(
          BigInt(Number(quickActionAmount) * 1e24),
          24,
        );

        // Check storage balance before depositing
        const [
          storageBalance,
          { account: accountCost, perMemeDeposit },
          wrapNearRegistered,
          wrapNearMinDeposit,
          wrapNearBalance,
        ] = await Promise.all([
          MemeCooking.storageBalanceOf($accountId$),
          MemeCooking.storageCosts(),
          Ft.isUserRegistered(
            import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!,
            $accountId$,
          ),
          Ft.storageRequirement(import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!),
          Ft.balanceOf(
            import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!,
            $accountId$,
            24,
          ),
        ]);

        let needStorageDeposit = null;
        if (
          storageBalance === null ||
          (storageBalance !== null &&
            new FixedNumber(storageBalance.available).toBigInt() <
              new FixedNumber(accountCost).toBigInt())
        ) {
          needStorageDeposit = {
            depositAmount: (
              BigInt(accountCost) +
              5n * BigInt(perMemeDeposit)
            ).toString(),
          };
        } else if (BigInt(storageBalance.available) < BigInt(perMemeDeposit)) {
          needStorageDeposit = {
            depositAmount: (5n * BigInt(perMemeDeposit)).toString(),
          };
        }

        let wrapNearDeposit = null;
        if (!wrapNearRegistered) {
          wrapNearDeposit = {
            depositAmount: wrapNearMinDeposit,
          };
        }

        const extraNearDeposit =
          input.toBigInt() > (wrapNearBalance?.toBigInt() ?? 0n)
            ? input.toBigInt() - (wrapNearBalance?.toBigInt() ?? 0n)
            : 0n;

        let referrer = getReferral() || undefined;

        if (referrer === $accountId$) {
          referrer = undefined;
          addToast({
            data: {
              type: "simple",
              data: {
                title: "Invalid Referral",
                description: "Referral cannot be the same as depositor",
                color: "red",
              },
            },
          });
        }

        await MemeCooking.deposit(
          wallet,
          {
            amount: input.toU128(),
            extraNearDeposit: extraNearDeposit.toString(),
            memeId: memebid.meme_id,
            referrer,
          },
          {
            onSuccess: () => {
              addToast({
                data: {
                  type: "simple",
                  data: {
                    title: "Deposit Success",
                    description: `You successfully deposited ${input.format()} NEAR`,
                  },
                },
              });
              if (update) update(undefined);
            },
          },
          needStorageDeposit,
          wrapNearDeposit,
        );

        openBottomSheet(ReferralSheet, {
          amount: input,
          meme: memebid,
        });
      } catch (e) {
        console.error(e);
      }
    }
  }
</script>

<div class="w-full rounded hover:ring-2 hover:ring-shitzu-3 bg-gray-800">
  {#if !isEnded}
    <div class="flex justify-between items-center p-1">
      {#if memebid.end_timestamp_ms}
        <div class="flex items-center gap-1">
          <div class="i-mdi:clock text-shitzu-4" />
          <Countdown
            class="text-shitzu-4 text-base"
            to={memebid.end_timestamp_ms}
            format="compact"
          />
        </div>
      {/if}
      {#if !isLaunched}
        <div class="flex-shrink-0 w-10 h-fit">
          <ProgressBarSmall meme={memebid} />
        </div>
      {/if}
    </div>
  {/if}
  <a href={`/meme/${memebid.meme_id}`} class="block">
    <div class="flex items-stretch">
      <!-- Image Section -->
      <div class="relative w-1/3 h-fit bg-white">
        <img
          src={`${import.meta.env.VITE_IPFS_GATEWAY}/${memebid.image}`}
          alt={memebid.name}
          class="w-full h-full object-contain"
        />
      </div>

      <div class="w-2/3 py-2 px-2 flex flex-col">
        <!-- Status Bar -->
        <div class="w-full flex justify-between items-center mb-2">
          <div class="w-full flex justify-between items-center gap-2">
            <span
              class={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${statusColor}`}
            >
              {status.toUpperCase()}
            </span>
          </div>
        </div>

        <!-- Title -->
        <div class="">
          <h3 class="text-base font-medium">
            {memebid.name}
            <span class="text-shitzu-4">${memebid.symbol}</span>
          </h3>
        </div>

        <!-- Description -->
        <p class="text-sm text-gray-300 line-clamp-2 mb-2">
          {memebid.description}
        </p>

        {#if showCook}
          <div class="text-xs w-full flex mb-2 gap-1 items-center">
            <div class="flex-shrink-0">by</div>
            <Chef account={memebid.owner} class="font-medium" />
          </div>
        {/if}

        <!-- Stats -->
        <div class="flex items-center justify-between text-sm mt-auto">
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-1">
              <span class="text-gray-400">MCap:</span>
              <span class="font-medium">
                {#if $projectedMcap}
                  ${$projectedMcap.format({
                    maximumFractionDigits: 1,
                    notation: "compact",
                  })}
                {:else}-{/if}
              </span>
            </div>
          </div>

          <div class="flex items-center gap-4">
            {#if typeof memebid.staker_count === "number"}
              <div class="flex items-center gap-1">
                <div class="i-mdi:account-multiple text-gray-400" />
                <span class="font-medium">{memebid.staker_count}</span>
              </div>
            {/if}
            {#if typeof memebid.replies_count === "number"}
              <div class="flex items-center gap-1">
                <div class="i-mdi:chat text-gray-400" />
                <span class="font-medium">{memebid.replies_count}</span>
              </div>
            {/if}
          </div>
        </div>

        {#if depositAmount != null || (isOwnAccount && claimAmount && claimAmount.valueOf() > 0n) || !isEnded || isLaunched}
          <!-- Actions -->
          <div class="mt-2 w-full">
            {#if depositAmount != null}
              <button
                class="px-3 py-1 w-full bg-gray-700 hover:bg-gray-600 rounded-sm flex items-center justify-center gap-1 leading-4"
                on:click={withdraw}
              >
                Withdraw {new FixedNumber(depositAmount, 24).format({
                  notation: "compact",
                })}
                <Near className="size-4 bg-white rounded-full text-black" />
              </button>
            {:else if isOwnAccount && claimAmount && claimAmount.valueOf() > 0n}
              <button
                class="px-3 py-1 w-full bg-shitzu-3 text-black hover:brightness-110 rounded-sm flex items-center justify-center gap-1 leading-4"
                on:click={claim}
              >
                Claim {claimAmount.format({ notation: "compact" })}
                <img
                  src="{import.meta.env.VITE_IPFS_GATEWAY}/{memebid.image}"
                  alt="token"
                  class="size-4 bg-white rounded-full text-black"
                />
              </button>
            {:else if !isEnded || isLaunched}
              <button
                class="px-3 py-1 w-full bg-shitzu-3 text-black hover:brightness-110 rounded-sm flex items-center justify-center gap-1"
                on:click={quickAction}
              >
                <Near className="size-4 bg-white rounded-full" />
                {quickActionAmount}
              </button>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </a>
</div>
