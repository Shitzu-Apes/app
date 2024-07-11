<script lang="ts">
  import { createTabs, melt } from "@melt-ui/svelte";
  import { writable } from "svelte/store";

  import Near from "$lib/assets/Near.svelte";
  import TokenInput from "$lib/components/TokenInput.svelte";
  import {
    Ft,
    MemeCooking,
    nearBalance,
    refreshNearBalance,
    wallet,
  } from "$lib/near";
  import { FixedNumber } from "$lib/util";

  const tabs = [
    { id: "stake", label: "stake" },
    { id: "unstake", label: "unstake" },
  ];

  const { accountId$ } = wallet;

  let input: TokenInput;
  $: input$ = input?.u128$;
  let inputValue$ = writable<string | undefined>();

  export let meme_id: number;

  const {
    elements: { root, list, trigger },
    states: { value },
  } = createTabs({
    defaultValue: "stake",
  });

  async function action() {
    if (!$input$ || !$accountId$) return;
    if ($value === "stake") {
      // Check storage balance before staking
      const [
        storageBalance,
        { min: minStorageBalance },
        wrapNearRegistered,
        wrapNearMinDeposit,
      ] = await Promise.all([
        MemeCooking.storageBalanceOf($accountId$),
        MemeCooking.storageBalanceBounds(),
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
          new FixedNumber(storageBalance).toBigInt() <
            new FixedNumber(minStorageBalance).toBigInt())
      ) {
        needStorageDeposit = {
          depositAmount: minStorageBalance,
        };
      }

      let wrapNearDeposit = null;
      if (!wrapNearRegistered) {
        wrapNearDeposit = {
          depositAmount: wrapNearMinDeposit,
        };
      }

      MemeCooking.deposit(
        wallet,
        { amount: $input$.toU128(), memeId: meme_id },
        {},
        needStorageDeposit,
        wrapNearDeposit,
      );
    } else {
      MemeCooking.withdraw(wallet, {
        amount: $input$.toU128(),
        memeId: meme_id,
      });
    }
  }

  $: refreshNearBalance();

  function setMax() {
    if ($nearBalance) {
      let input = $nearBalance.sub(new FixedNumber(5n, 1));

      input = input.toNumber() < 0 ? new FixedNumber(0n, 24) : input;

      $inputValue$ = input.toNumber().toFixed(4);
    }
  }
</script>

<div
  use:melt={$root}
  class="w-full h-full flex flex-col justify-between items-center"
>
  <div use:melt={$list} class="flex justify-between items-stretch gap-6 w-full">
    {#each tabs as tab}
      <button
        use:melt={$trigger(tab.id)}
        class="w-1/2 py-1 {tab.id === $value
          ? 'text-shitzu-4 border-current'
          : 'text-gray-4 border-transparent'} border-b-4 font-600"
      >
        {tab.label}
      </button>
    {/each}
  </div>
  <div class="h-5"></div>
  <div class="relative">
    <div class="absolute inset-y-0 left-0 flex items-center pl-2">
      <Near className="w-6 h-6" />
    </div>
    <TokenInput
      class="bg-transparent rounded-xl w-full py-2  text-center text-2xl px-14 appearance-none outline-none"
      decimals={24}
      bind:this={input}
      bind:value={$inputValue$}
    />
    <div class="absolute inset-y-0 right-0 flex items-center pr-2">
      <button
        on:click={setMax}
        class="text-sm cursor-pointer bg-shitzu-4 px-2 rounded-full border border-shitzu-6"
      >
        Max
      </button>
    </div>
  </div>
  <ul class="flex items-center w-full gap-2">
    {#each [{ value: "0", label: "reset" }, { value: "1", label: "1" }, { value: "5", label: "5" }, { value: "10", label: "10" }] as value}
      <li class="text-sm bg-shitzu-8 px-1 rounded">
        <button
          class="hover:text-shitzu-4 flex items-center gap-1"
          on:click={() => {
            $inputValue$ = new FixedNumber(value.value, 24).toU128();
          }}
        >
          {#if value.value !== "0"}
            <Near className="size-4" />
          {/if}
          {value.label}
        </button>
      </li>
    {/each}
  </ul>
  <button
    on:click={action}
    class="bg-shitzu-3 w-full py-2 rounded-full text-xl tracking-wider text-black border-b-4 border-shitzu-4 active:translate-y-1"
    >[{$value}]</button
  >
</div>
