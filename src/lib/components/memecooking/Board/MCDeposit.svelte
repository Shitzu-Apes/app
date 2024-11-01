<script lang="ts">
  import { onDestroy } from "svelte";
  import { writable } from "svelte/store";
  import { match, P } from "ts-pattern";

  import { addToast } from "../../Toast.svelte";
  import ReferralSheet from "../BottomSheet/ReferralSheet.svelte";

  import Tabs from "./Tabs.svelte";

  import Near from "$lib/assets/Near.svelte";
  import { showWalletSelector } from "$lib/auth";
  import { Button } from "$lib/components";
  import ToggleSwitch from "$lib/components/ToggleSwitch.svelte";
  import TokenInput from "$lib/components/TokenInput.svelte";
  import {
    closeBottomSheet,
    openBottomSheet,
  } from "$lib/layout/BottomSheet/Container.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { Ft, nearBalance, refreshNearBalance, wallet } from "$lib/near";
  import {
    mcAccount$,
    MemeCooking,
    updateMcAccount,
  } from "$lib/near/memecooking";
  import { FixedNumber } from "$lib/util";
  import { getReferral } from "$lib/util/referral";

  const tabs = [
    { id: "deposit", label: "Deposit" },
    { id: "withdraw", label: "Withdraw" },
  ];

  let activeTab = "deposit";

  const { accountId$ } = wallet;

  let input: TokenInput;
  $: input$ = input?.u128$;
  let inputValue$ = writable<string | undefined>();

  export let meme: Meme;

  let unwrapNear: boolean = true;

  const depositAmount$ = writable<FixedNumber | undefined>();
  $: if ($mcAccount$) {
    $mcAccount$.then((mcAccount) => {
      if (!mcAccount) return;
      const deposit = mcAccount.deposits.find(
        ({ meme_id }) => meme_id === meme.meme_id,
      );
      $depositAmount$ = new FixedNumber(deposit?.amount ?? "0", 24);
    });
  }

  $: finished =
    meme.end_timestamp_ms != null && meme.end_timestamp_ms < Date.now();
  const timer = setInterval(() => {
    finished =
      meme.end_timestamp_ms != null && meme.end_timestamp_ms < Date.now();
  }, 1_000);

  onDestroy(() => {
    clearInterval(timer);
  });

  let totalNearBalance$ = writable($nearBalance);
  let wrapNearBalance: FixedNumber | null = null;
  $: if ($accountId$ && $nearBalance) {
    Ft.balanceOf(
      import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!,
      $accountId$,
      24,
    ).then((balance) => {
      wrapNearBalance = balance;
      $totalNearBalance$ = $nearBalance.add(balance);
    });
  }

  $: hasEnoughTokens = match([
    activeTab,
    [$input$, $depositAmount$, $totalNearBalance$],
  ])
    .with(
      ["deposit", P.select()],
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ([input, _, amount]) =>
        amount != null && input != null && input.valueOf() <= amount.valueOf(),
    )
    .with(
      ["withdraw", P.select()],
      ([input, amount]) =>
        amount != null && input != null && input.valueOf() <= amount.valueOf(),
    )
    .otherwise(() => false);

  async function action() {
    if (!$accountId$) {
      showWalletSelector("shitzu");
      return;
    }
    if (!$input$) {
      addToast({
        data: {
          type: "simple",
          data: {
            title: "Error",
            description: "Please enter a valid amount",
            color: "red",
          },
        },
      });
      return;
    }

    if (activeTab === "deposit") {
      // Check storage balance before depositing
      const [
        storageBalance,
        { account: accountCost, perMemeDeposit },
        wrapNearRegistered,
        wrapNearMinDeposit,
      ] = await Promise.all([
        MemeCooking.storageBalanceOf($accountId$),
        MemeCooking.storageCosts(),
        Ft.isUserRegistered(
          import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!,
          $accountId$,
        ),
        Ft.storageRequirement(import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!),
      ]);

      let needStorageDeposit = null;
      if (
        // no storage balance or
        // storage balance is less than min storage balance

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
        $input$.toBigInt() > (wrapNearBalance?.toBigInt() ?? 0n)
          ? $input$.toBigInt() - (wrapNearBalance?.toBigInt() ?? 0n)
          : 0n;

      if ($nearBalance && extraNearDeposit > $nearBalance.toBigInt()) {
        console.error("Not enough NEAR balance");
        return;
      }

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

      const amount = $input$.clone();
      await MemeCooking.deposit(
        wallet,
        {
          amount: $input$.toU128(),
          extraNearDeposit: extraNearDeposit.toString(),
          memeId: meme.meme_id,
          referrer,
        },
        {
          onSuccess: () => {
            $inputValue$ = "";
            addToast({
              data: {
                type: "simple",
                data: {
                  title: "Deposit Success",
                  description: `You successfully deposited ${$input$.format()} NEAR`,
                },
              },
            });
          },
        },
        needStorageDeposit,
        wrapNearDeposit,
      );

      openBottomSheet(ReferralSheet, {
        amount,
        meme,
      });
    } else {
      const onSuccess = () => {
        $inputValue$ = "";
        addToast({
          data: {
            type: "simple",
            data: {
              title: "Withdraw Success",
              description: `You have successfully withdrawn ${$input$.format()} NEAR`,
            },
          },
        });
        closeBottomSheet();
      };
      if (meme.end_timestamp_ms != null && meme.end_timestamp_ms < Date.now()) {
        return MemeCooking.claim(
          wallet,
          {
            meme,
            unwrapNear,
            unwrapAmount: $depositAmount$?.toU128() ?? "",
          },
          {
            onSuccess,
          },
        );
      } else {
        return MemeCooking.withdraw(
          wallet,
          {
            amount: $input$.toU128(),
            memeId: meme.meme_id,
            unwrapNear,
          },
          {
            onSuccess,
          },
        );
      }
    }
  }

  function setMax() {
    if (activeTab === "deposit") {
      if ($totalNearBalance$) {
        let input = $totalNearBalance$.sub(new FixedNumber(5n, 1));

        input = input.toNumber() < 0 ? new FixedNumber(0n, 24) : input;

        $inputValue$ = input.toString();
      }
    } else {
      if (!$depositAmount$) {
        return;
      }
      $inputValue$ = $depositAmount$.toString();
    }
  }

  const defaultValues: {
    [key: string]: { value: string; label: string };
  }[] = [
    {
      deposit: { value: "0", label: "reset" },
      withdraw: { value: "0", label: "reset" },
    },
    {
      deposit: {
        value: 10_000_000_000_000_000_000_000_000n.toString(),
        label: "10",
      },
      withdraw: { value: "25", label: "25%" },
    },
    {
      deposit: {
        value: 50_000_000_000_000_000_000_000_000n.toString(),
        label: "50",
      },
      withdraw: { value: "50", label: "50%" },
    },
    {
      deposit: {
        value: 100_000_000_000_000_000_000_000_000n.toString(),
        label: "100",
      },
      withdraw: { value: "100", label: "100%" },
    },
  ];
</script>

<div class="w-full h-full flex flex-col justify-start items-center">
  <Tabs
    {tabs}
    bind:activeTab
    on:change={() => {
      $inputValue$ = "";
    }}
    class="w-full mx-auto"
  />
  <div class="px-3">
    <div class="relative my-6">
      <div class="absolute inset-y-0 left-0 flex items-center pl-2">
        <Near className="w-6 h-6 bg-white text-black rounded-full" />
      </div>
      <TokenInput
        class="bg-transparent rounded-xl w-full py-6 text-center text-2xl px-14 appearance-none outline-none {activeTab ===
        'deposit'
          ? 'text-shitzu-4'
          : 'text-rose-5'}"
        decimals={24}
        readonly={finished}
        bind:this={input}
        bind:value={$inputValue$}
      />
      <div
        class="absolute inset-y-0 right-0 flex flex-col justify-center items-center pr-2 text-xs gap-1"
      >
        <div class="flex-grow basis-0" />
        <button
          class="text-sm cursor-pointer bg-gray-3 px-2 rounded-full border border-gray-6 {activeTab ===
          'deposit'
            ? 'text-shitzu-7'
            : 'text-rose-5'}"
          on:click={setMax}
        >
          <div class="">Max</div>
        </button>
        <div
          class="{activeTab === 'deposit'
            ? 'text-shitzu-4'
            : 'text-rose-4'} flex-grow basis-0"
        >
          {#if activeTab === "withdraw"}
            {#if $depositAmount$ != null}
              {$depositAmount$.format()}
            {:else}
              -
            {/if}
          {:else if $totalNearBalance$}
            {$totalNearBalance$.format()}
          {/if}
        </div>
      </div>
    </div>
    <ul class="flex items-center w-full gap-2">
      {#each defaultValues as defaultValue}
        <li
          class="text-sm {activeTab === 'deposit'
            ? 'bg-shitzu-8'
            : 'bg-rose-5'} px-1 py-2 rounded flex-1 basis-0"
        >
          <button
            class="text-white {activeTab === 'deposit'
              ? 'hover:text-shitzu-4'
              : 'hover:text-rose-2'} w-full flex justify-center items-center gap-1"
            on:click={() => {
              if (activeTab === "deposit") {
                $inputValue$ = new FixedNumber(
                  defaultValue[activeTab].value,
                  24,
                ).toString();
              } else {
                if ($depositAmount$ == null) return;
                const bps = new FixedNumber(defaultValue[activeTab].value, 2);
                $inputValue$ = $depositAmount$.mul(bps).toString();
              }
            }}
          >
            {#if defaultValue[activeTab].value !== "0" && activeTab === "deposit"}
              <Near className="size-4" />
            {/if}
            {defaultValue[activeTab].label}
          </button>
        </li>
      {/each}
    </ul>

    <div
      class="{activeTab === 'deposit'
        ? 'invisible'
        : ''} w-full flex items-center justify-between my-4"
    >
      <span class="text-white">Unwrap wNEAR</span>
      <ToggleSwitch
        bind:enabled={unwrapNear}
        on:toggle={() => {
          if (activeTab === "withdraw") {
            unwrapNear = !unwrapNear;
          }
        }}
      />
    </div>

    <Button
      onClick={async () => {
        await action();
        if (!$accountId$) return;
        await new Promise((resolve) => setTimeout(resolve, 5_000));
        refreshNearBalance($accountId$);
        updateMcAccount($accountId$);
      }}
      type="custom"
      disabled={$input$ == null ||
        $input$.toNumber() == 0 ||
        finished ||
        !hasEnoughTokens}
      class="{activeTab === 'deposit'
        ? 'bg-shitzu-4'
        : 'bg-rose-4'} w-full py-2 rounded text-xl tracking-wider text-black {activeTab ===
      'deposit'
        ? 'border-shitzu-5'
        : 'border-rose-5'} active:translate-y-1 my-4 capitalize"
    >
      {#if finished}
        finished
      {:else}
        {activeTab}
      {/if}
    </Button>
  </div>
</div>
