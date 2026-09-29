<script lang="ts">
  import type { CreateQueryResult } from "@tanstack/svelte-query";

  import { addToast } from "../../Toast.svelte";
  import ReferralSheet from "../BottomSheet/ReferralSheet.svelte";

  import {
    useTokenRegistrationQuery,
    useTokenStorageRequirementQuery,
  } from "$lib/api/queries/balance";
  import {
    useMcStorageBalanceQuery,
    useMcReferrerStorageBalanceQuery,
    useMcStorageCostsQuery,
  } from "$lib/api/queries/memecooking";
  import Button from "$lib/components/Button.svelte";
  import Stepper from "$lib/components/Stepper.svelte";
  import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { nearBalance, refreshNearBalance, nearWallet } from "$lib/near";
  import { MemeCooking, updateMcAccount } from "$lib/near/memecooking";
  import { fetchBlockHeight } from "$lib/near/rpc";
  import {
    awaitIndexerBlockHeight,
    awaitRpcBlockHeight,
  } from "$lib/store/indexer";
  import { FixedNumber } from "$lib/util";
  import { getReferral, removeReferral } from "$lib/util/referral";

  export let meme: Meme;
  export let accountId: string;
  export let input: FixedNumber;
  export let wrapNearBalance: CreateQueryResult<FixedNumber>;
  export let finished: boolean;
  export let hasEnoughTokens: boolean;
  export let onTransact: () => void;
  export let disabled: boolean = false;

  const referral = getReferral();
  const wrapNearRegistrationQuery = useTokenRegistrationQuery(
    import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!,
    accountId,
  );
  const wrapNearStorageQuery = useTokenStorageRequirementQuery(
    import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!,
  );
  const storageBalanceQuery = useMcStorageBalanceQuery(accountId);
  const referrerStorageBalanceQuery = useMcReferrerStorageBalanceQuery(
    referral || undefined,
  );
  const storageCostsQuery = useMcStorageCostsQuery();

  // Add this before the action function
  $: depositSteps = (() => {
    if (
      !$storageBalanceQuery.data ||
      !$storageCostsQuery.data ||
      !$wrapNearRegistrationQuery.data ||
      !$wrapNearStorageQuery.data
    ) {
      return [];
    }

    const steps: { text: string }[] = [];

    // Check referrer validity first
    if (referral) {
      if (referral === accountId) {
        steps.push({
          text: "⚠️ Referral cannot be the same as depositor - referral will be ignored",
        });
      } else if ($referrerStorageBalanceQuery.data === null) {
        steps.push({
          text: "⚠️ Referral not registered - referral will be ignored",
        });
      }
    }

    // Storage deposit checks
    if (
      $storageBalanceQuery.data === null ||
      ($storageBalanceQuery.data !== null &&
        new FixedNumber($storageBalanceQuery.data.available).toBigInt() <
          new FixedNumber($storageCostsQuery.data.account).toBigInt())
    ) {
      const depositAmount = (
        BigInt($storageCostsQuery.data.account) +
        5n * BigInt($storageCostsQuery.data.perMemeDeposit)
      ).toString();
      steps.push({
        text: `Register account with storage deposit of ${new FixedNumber(depositAmount, 24).format()} NEAR`,
      });
    } else if (
      BigInt($storageBalanceQuery.data.available) <
      BigInt($storageCostsQuery.data.perMemeDeposit)
    ) {
      const depositAmount = (
        5n * BigInt($storageCostsQuery.data.perMemeDeposit)
      ).toString();
      steps.push({
        text: `Add storage deposit of ${new FixedNumber(depositAmount, 24).format()} NEAR`,
      });
    }

    // wNEAR registration check
    if (!$wrapNearRegistrationQuery.data) {
      steps.push({
        text: `Register wNEAR token (${new FixedNumber($wrapNearStorageQuery.data, 24).format()} NEAR)`,
      });
    }

    // NEAR wrapping check
    const extraNearDeposit =
      input?.toBigInt() > ($wrapNearBalance?.data?.toBigInt() ?? 0n)
        ? input.toBigInt() - ($wrapNearBalance?.data?.toBigInt() ?? 0n)
        : 0n;
    if (extraNearDeposit > 0n) {
      steps.push({
        text: `Wrap ${new FixedNumber(extraNearDeposit.toString(), 24).format()} NEAR to wNEAR`,
      });
    }

    // Always add the final deposit step
    if (input) {
      steps.push({
        text: `Deposit ${input.format()} NEAR to $${meme.symbol}`,
      });
    }

    return steps;
  })();

  async function action() {
    let referrer = referral || undefined;

    if (
      !$storageBalanceQuery.data ||
      !$storageCostsQuery.data ||
      !$wrapNearRegistrationQuery.data ||
      !$wrapNearStorageQuery.data ||
      (referrer && !$referrerStorageBalanceQuery.data)
    ) {
      console.error("Queries still loading or failed");
      return;
    }

    const storageBalance = $storageBalanceQuery.data;
    const storageCosts = $storageCostsQuery.data;
    const wrapNearRegistered = $wrapNearRegistrationQuery.data;
    const wrapNearMinDeposit = $wrapNearStorageQuery.data;
    const referrerStorageBalance = $referrerStorageBalanceQuery.data;

    const { account: accountCost, perMemeDeposit } = storageCosts;

    // Update referrer based on validation
    if (
      referrer === accountId ||
      (referrer && referrerStorageBalance === null)
    ) {
      referrer = undefined;
      if (referral) {
        removeReferral();
      }
    }

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
      input.toBigInt() > ($wrapNearBalance.data?.toBigInt() ?? 0n)
        ? input.toBigInt() - ($wrapNearBalance.data?.toBigInt() ?? 0n)
        : 0n;

    if (nearBalance && extraNearDeposit > ($nearBalance?.toBigInt() ?? 0n)) {
      console.error("Not enough NEAR balance");
      return;
    }

    const amount = input.clone();
    onTransact();
    await MemeCooking.deposit(
      nearWallet,
      {
        amount: input.toU128(),
        extraNearDeposit: extraNearDeposit.toString(),
        memeId: meme.meme_id,
        referrer,
      },
      {
        onSuccess: async (outcome) => {
          addToast({
            data: {
              type: "simple",
              data: {
                title: "Deposit Success",
                description: `You successfully deposited ${input.format()} NEAR`,
              },
            },
          });

          if (!outcome) return;
          const blockHeight = await fetchBlockHeight(outcome);
          await Promise.all([
            awaitIndexerBlockHeight(blockHeight),
            awaitRpcBlockHeight(blockHeight),
          ]);
          refreshNearBalance(accountId);
          updateMcAccount(accountId);
        },
      },
      needStorageDeposit,
      wrapNearDeposit,
    );

    openBottomSheet(ReferralSheet, {
      amount,
      meme,
    });
  }
</script>

<Button
  onClick={async () => {
    await action();
  }}
  type="custom"
  disabled={input == null ||
    input.toNumber() == 0 ||
    finished ||
    !hasEnoughTokens ||
    disabled}
  class="
     bg-shitzu-4
     w-full py-2 rounded text-xl tracking-wider text-black 
     border-shitzu-5
     active:translate-y-1 capitalize"
>
  {#if finished}
    finished
  {:else}
    deposit
  {/if}
</Button>

{#if depositSteps.length > 0 && input.toNumber() > 0}
  <div class="mt-4 mb-4">
    <div class="font-medium text-white mb-4">Transaction steps:</div>
    <Stepper steps={depositSteps} />
  </div>
{/if}
