<script lang="ts">
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";

  import TeamAllocationSheet from "../../BottomSheet/TeamAllocationSheet.svelte";

  import Near from "$lib/assets/Near.svelte";
  import { showWalletSelector } from "$lib/auth";
  import McIcon from "$lib/components/MCIcon.svelte";
  import { addToast } from "$lib/components/Toast.svelte";
  import ReferralSheet from "$lib/components/memecooking/BottomSheet/ReferralSheet.svelte";
  import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { Ref, nearWallet } from "$lib/near";
  import { Ft } from "$lib/near";
  import { MemeCooking } from "$lib/near/memecooking";
  import { handleBuy } from "$lib/near/swap";
  import { FixedNumber } from "$lib/util";
  import { getTokenId } from "$lib/util/getTokenId";
  import { getReferral, removeReferral } from "$lib/util/referral";

  const { accountId$ } = nearWallet;
  export let update:
    | ((
        outcome: FinalExecutionOutcome | FinalExecutionOutcome[] | undefined,
      ) => void)
    | undefined = undefined;
  export let memebid: Meme;
  export let depositAmount: string | undefined = undefined;
  export let isOwnAccount: boolean = false;
  export let claimAmount: FixedNumber | undefined = undefined;
  export let isEnded: boolean;
  export let isLaunched: boolean;
  export let quickActionAmount: string | undefined = undefined;

  const buttonClass =
    "px-3 py-1 w-full rounded-sm flex items-center justify-center gap-1 text-sm";

  async function withdraw(ev: Event) {
    ev.preventDefault();
    if (!memebid.end_timestamp_ms || !depositAmount) return;

    try {
      if (memebid.end_timestamp_ms < Date.now()) {
        await MemeCooking.claim(
          nearWallet,
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
          nearWallet,
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
      await MemeCooking.claim(
        nearWallet,
        { meme: memebid },
        { onSuccess: update },
      );
    } catch (e) {
      console.error(e);
    }
  }

  async function claimTeamAllocation(ev: Event) {
    ev.preventDefault();
    openBottomSheet(TeamAllocationSheet, { meme: memebid });
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
        tokenOut: getTokenId(memebid),
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

        let referrer = getReferral() || undefined;
        // Check storage balance before depositing
        const [
          storageBalance,
          { account: accountCost, perMemeDeposit },
          wrapNearRegistered,
          wrapNearMinDeposit,
          wrapNearBalance,
          referrerStorageBalance,
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
          referrer ? MemeCooking.storageBalanceOf(referrer) : null,
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
        } else if (referrer && referrerStorageBalance === null) {
          referrer = undefined;
          removeReferral();
          addToast({
            data: {
              type: "simple",
              data: {
                title: "Invalid Referral",
                description: "Referral not registered",
                color: "red",
              },
            },
          });
        }

        await MemeCooking.deposit(
          nearWallet,
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

{#if depositAmount != null}
  <button
    class="{buttonClass} bg-rose-700 hover:bg-rose-600"
    on:click={withdraw}
  >
    Withdraw {new FixedNumber(depositAmount, 24).format({
      notation: "compact",
    })}
    <Near className="size-4 bg-white rounded-full text-black" />
  </button>
{:else if isOwnAccount && claimAmount && claimAmount.valueOf() > 0n}
  <button
    class="{buttonClass} bg-shitzu-3 text-black hover:brightness-110"
    on:click={claim}
  >
    Claim {claimAmount.format({ notation: "compact" })}
    <McIcon meme={memebid} class="size-4 bg-white rounded-full text-black" />
  </button>
{:else if isLaunched && isOwnAccount && memebid.owner === $accountId$ && memebid.team_allocation && BigInt(memebid.team_allocation) > 0n}
  <button
    class="{buttonClass} bg-shitzu-3 text-black hover:brightness-110"
    on:click={claimTeamAllocation}
  >
    Claim Team Allocation
    <McIcon meme={memebid} class="size-4 bg-white rounded-full text-black" />
  </button>
{:else if quickActionAmount != undefined && (!isEnded || isLaunched)}
  <button
    class="{buttonClass} bg-shitzu-3 text-black hover:brightness-110"
    on:click={quickAction}
  >
    <Near className="size-4 bg-white rounded-full" />
    {quickActionAmount}
  </button>
{/if}
