<script lang="ts">
  import { createTabs, melt } from "@melt-ui/svelte";
  import { onDestroy } from "svelte";
  import { writable } from "svelte/store";

  import { addToast } from "../Toast.svelte";

  import Near from "$lib/assets/Near.svelte";
  import { Button } from "$lib/components";
  import TokenInput from "$lib/components/TokenInput.svelte";
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
    { id: "stake", label: "stake" },
    { id: "unstake", label: "unstake" },
  ];

  const { accountId$ } = wallet;

  let input: TokenInput;
  $: input$ = input?.u128$;
  let inputValue$ = writable<string | undefined>();

  export let meme: Meme;

  const depositAmount$ = writable<FixedNumber | undefined>();
  $: if ($mcAccount$) {
    const deposit = $mcAccount$.deposits.find(
      ([memeId]) => memeId === meme.meme_id,
    );
    $depositAmount$ = new FixedNumber(deposit?.[1] ?? "0", 24);
  }

  const {
    elements: { root, list, trigger },
    states: { value },
  } = createTabs({
    defaultValue: "stake",
  });

  $: finished =
    $value === "stake" &&
    meme.end_timestamp_ms != null &&
    meme.end_timestamp_ms < Date.now();
  const timer = setInterval(() => {
    finished =
      $value === "stake" &&
      meme.end_timestamp_ms != null &&
      meme.end_timestamp_ms < Date.now();
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

  async function action() {
    if (!$accountId$) {
      console.error("No input or account id");
      addToast({
        data: {
          type: "simple",
          data: {
            title: "Error",
            description: "Please Connect Wallet",
            color: "red",
          },
        },
      });
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

    if ($value === "stake") {
      // Check storage balance before staking
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
              description: "Referral cannot be the same as staker",
              color: "red",
            },
          },
        });
      }

      return MemeCooking.deposit(
        wallet,
        {
          amount: $input$.toU128(),
          extraNearDeposit: extraNearDeposit.toString(),
          memeId: meme.meme_id,
          referrer: referrer,
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
    } else {
      return MemeCooking.withdraw(
        wallet,
        {
          amount: $input$.toU128(),
          memeId: meme.meme_id,
        },
        {
          onSuccess: () => {
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
          },
        },
      );
    }
  }

  function setMax() {
    if ($value === "stake") {
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
      stake: { value: "0", label: "reset" },
      unstake: { value: "0", label: "reset" },
    },
    {
      stake: {
        value: 10_000_000_000_000_000_000_000_000n.toString(),
        label: "10",
      },
      unstake: { value: "25", label: "25%" },
    },
    {
      stake: {
        value: 50_000_000_000_000_000_000_000_000n.toString(),
        label: "50",
      },
      unstake: { value: "50", label: "50%" },
    },
    {
      stake: {
        value: 100_000_000_000_000_000_000_000_000n.toString(),
        label: "100",
      },
      unstake: { value: "100", label: "100%" },
    },
  ];
</script>

<div
  use:melt={$root}
  class="w-full h-full flex flex-col justify-start items-center"
>
  <div use:melt={$list} class="flex justify-between items-stretch gap-6 w-full">
    {#each tabs as tab}
      <button
        use:melt={$trigger(tab.id)}
        on:click={() => {
          $inputValue$ = "";
        }}
        class="w-1/2 py-1 {tab.id === $value
          ? 'text-shitzu-4 border-current'
          : 'text-gray-4 border-transparent'} border-b-4 font-600"
      >
        {tab.label}
      </button>
    {/each}
  </div>
  <div class="px-3">
    <div class="relative my-6">
      <div class="absolute inset-y-0 left-0 flex items-center pl-2">
        <!-- {#if $value === "stake"} -->
        <Near className="w-6 h-6 bg-white text-black rounded-full" />
        <!-- {:else}
          <img
            src="{import.meta.env.VITE_IPFS_GATEWAY}/{meme.image}"
            alt={meme.name}
            class="w-6 h-6 rounded-full"
          />
        {/if} -->
      </div>
      <TokenInput
        class="bg-transparent rounded-xl w-full py-6 text-center text-2xl px-14 appearance-none outline-none {$value ===
        'stake'
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
          class="text-sm cursor-pointer bg-gray-3 px-2 rounded-full border border-gray-6 {$value ===
          'stake'
            ? 'text-shitzu-7'
            : 'text-rose-5'}"
          on:click={setMax}
        >
          <div class="">Max</div>
        </button>
        <div
          class="{$value === 'stake'
            ? 'text-shitzu-4'
            : 'text-rose-4'} flex-grow basis-0"
        >
          {#if $value === "unstake"}
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
          class="text-sm {$value === 'stake'
            ? 'bg-shitzu-8'
            : 'bg-rose-5'} px-1 rounded"
        >
          <button
            class="{$value === 'stake'
              ? 'hover:text-shitzu-4'
              : 'hover:text-rose-2'} flex items-center gap-1"
            on:click={() => {
              if ($value === "stake") {
                $inputValue$ = new FixedNumber(
                  defaultValue[$value].value,
                  24,
                ).toString();
              } else {
                if ($depositAmount$ == null) return;
                const bps = new FixedNumber(defaultValue[$value].value, 2);
                $inputValue$ = $depositAmount$.mul(bps).toString();
              }
            }}
          >
            {#if defaultValue[$value].value !== "0" && $value === "stake"}
              <Near className="size-4" />
            {/if}
            {defaultValue[$value].label}
          </button>
        </li>
      {/each}
    </ul>
    <Button
      onClick={async () => {
        await action();
        if (!$accountId$) return;
        await new Promise((resolve) => setTimeout(resolve, 5_000));
        refreshNearBalance($accountId$);
        updateMcAccount($accountId$);
      }}
      type="custom"
      disabled={$input$ == null || $input$.toNumber() == 0 || finished}
      class="{$value === 'stake'
        ? 'bg-shitzu-3'
        : 'bg-rose-4'} w-full py-2 rounded-full text-xl tracking-wider text-black border-b-4 {$value ===
      'stake'
        ? 'border-shitzu-4'
        : 'border-rose-5'} active:translate-y-1 my-4"
    >
      {#if finished}
        [finished]
      {:else}
        [{$value}]
      {/if}
    </Button>
  </div>
</div>
