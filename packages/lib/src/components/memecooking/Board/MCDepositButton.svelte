<script lang="ts">
  import type { CreateQueryResult } from "@tanstack/svelte-query";

  import { addToast } from "../../Toast.svelte";
  import ReferralSheet from "../BottomSheet/ReferralSheet.svelte";

  import { buildDepositPlan } from "./depositPlan";

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

  // `storage_balance_of` answers null for an account that never registered and
  // `isUserRegistered` answers false for one that never registered on wNEAR.
  // Both are answers, not failures: they are the states that get a storage
  // deposit folded into the same transaction. Only the query status can tell
  // them apart from data that has not arrived.
  $: coreQueriesReady =
    $storageBalanceQuery.status === "success" &&
    $storageCostsQuery.status === "success" &&
    $wrapNearRegistrationQuery.status === "success" &&
    $wrapNearStorageQuery.status === "success";

  $: coreQueriesFailed = [
    $storageBalanceQuery,
    $storageCostsQuery,
    $wrapNearRegistrationQuery,
    $wrapNearStorageQuery,
  ].some((query) => query.status === "error");

  $: referrerPending =
    !!referral && $referrerStorageBalanceQuery.status === "pending";

  $: referrerBalance =
    $referrerStorageBalanceQuery.status === "success"
      ? { known: true as const, balance: $referrerStorageBalanceQuery.data }
      : { known: false as const };

  $: depositPlan =
    coreQueriesReady && !referrerPending
      ? buildDepositPlan({
          accountId,
          referral,
          storageBalance: $storageBalanceQuery.data!,
          storageCosts: $storageCostsQuery.data!,
          wrapNearRegistered: $wrapNearRegistrationQuery.data!,
          wrapNearMinDeposit: $wrapNearStorageQuery.data!,
          referrerBalance,
          input,
          wrapNearBalance: $wrapNearBalance.data,
          memeSymbol: meme.symbol,
        })
      : null;

  $: depositSteps = (depositPlan?.steps ?? []).map((text) => ({ text }));

  async function action() {
    if (coreQueriesFailed) {
      addToast({
        data: {
          type: "simple",
          data: {
            title: "Could not load deposit details",
            description: "Retrying - please try again in a moment.",
            type: "error",
          },
        },
      });
      await Promise.all([
        $storageBalanceQuery.refetch(),
        $storageCostsQuery.refetch(),
        $wrapNearRegistrationQuery.refetch(),
        $wrapNearStorageQuery.refetch(),
        ...(referral ? [$referrerStorageBalanceQuery.refetch()] : []),
      ]);
      return;
    }

    if (!depositPlan) {
      addToast({
        data: {
          type: "simple",
          data: {
            title: "Still loading",
            description:
              "Deposit details are still loading - please try again.",
            type: "error",
          },
        },
      });
      return;
    }

    const { referrer, needStorageDeposit, wrapNearDeposit, extraNearDeposit } =
      depositPlan;

    if (depositPlan.referralRejected) {
      removeReferral();
    }

    if (nearBalance && extraNearDeposit > ($nearBalance?.toBigInt() ?? 0n)) {
      addToast({
        data: {
          type: "simple",
          data: {
            title: "Not enough NEAR balance",
            description: "Add NEAR to cover the deposit and its storage.",
            type: "error",
          },
        },
      });
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
