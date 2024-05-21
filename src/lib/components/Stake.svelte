<script lang="ts">
  import { createTabs, melt } from "@melt-ui/svelte";
  import { FixedNumber } from "@tarnadas/fixed-number";
  import { writable } from "svelte/store";
  import { crossfade, fade, slide } from "svelte/transition";
  import { match } from "ts-pattern";

  import { TokenInput } from "$lib/components";
  import { wallet } from "$lib/near";

  export let walletConnected: boolean;
  export let nearBalance: FixedNumber;
  export let stake: FixedNumber;
  export let afterUpdateBalances: () => void;

  const [send, receive] = crossfade({
    duration: 300,
  });

  let newNearBalance: FixedNumber | undefined;
  let newStakeBalance: FixedNumber | undefined;

  const {
    elements: { list, trigger },
    states: { value },
  } = createTabs({
    defaultValue: "Stake",
  });

  let tabs: { label: "Stake" | "Unstake" }[] = [
    {
      label: "Stake",
    },
    {
      label: "Unstake",
    },
  ];
  $: active = { label: $value } as (typeof tabs)[number];

  let input: TokenInput;
  let inputValue$ = writable<string | undefined>();
  $: input$ = input?.u128$;

  $: if (active) {
    $inputValue$ = "";
  }

  $: updateOutAmount(active.label, $input$);
  function updateOutAmount(label: "Stake" | "Unstake", val?: FixedNumber) {
    if (!val || val.valueOf() === 0n) {
      newNearBalance = undefined;
      newStakeBalance = undefined;
      return;
    }
    match(label)
      .with("Stake", () => {
        newNearBalance = nearBalance.sub(val);
        newStakeBalance = stake.add(val);
      })
      .with("Unstake", () => {
        newNearBalance = nearBalance.add(val);
        newStakeBalance = stake.sub(val);
      })
      .exhaustive();
  }

  let disabled = true;
  $: if (!newNearBalance || !newStakeBalance) {
    disabled = true;
  } else if (newNearBalance.valueOf() < 0 || newStakeBalance.valueOf() < 0) {
    disabled = true;
  } else if ($input$?.valueOf() === 0n) {
    disabled = true;
  } else {
    disabled = false;
  }

  function setMax() {
    $inputValue$ = match(active.label)
      .with("Stake", () => nearBalance.sub(new FixedNumber(5n, 1)).toString())
      .with("Unstake", () => stake.toString())
      .exhaustive();
  }

  let loading = false;
  async function runTx() {
    if (!$input$ || $input$.valueOf() === 0n) return;
    loading = true;
    await wallet.signAndSendTransaction(
      {
        receiverId: import.meta.env.VITE_VALIDATOR_CONTRACT_ID,
        actions: [
          {
            type: "FunctionCall",
            params: match(active.label)
              .with("Stake", () => ({
                methodName: "deposit_and_stake",
                args: {},
                gas: 30_000_000_000_000,
                deposit: $input$.toU128(),
              }))
              .with("Unstake", () => ({
                methodName: "unstake",
                args: {
                  amount: $input$.toU128(),
                },
                gas: 30_000_000_000_000,
                deposit: "0",
              }))
              .exhaustive(),
          },
        ],
      },
      {
        onSuccess: () => {
          afterUpdateBalances();
          $inputValue$ = "";
        },
        onFinally: () => {
          loading = false;
        },
      },
    );
  }
</script>

<div
  transition:slide
  use:melt={$list}
  class="flex shrink-0 justify-evenly overflow-x-auto text-white font-bold text-xl mb-5"
  aria-label="Manage your account"
>
  {#each tabs as { label }}
    <button use:melt={$trigger(label)} class="trigger relative first">
      {#if $value === label}
        <div
          in:send={{ key: "trigger" }}
          out:receive={{ key: "trigger" }}
          class="absolute bottom-0 left-1/2 h-1 w-[120%] -translate-x-1/2 rounded-full bg-lime rounded"
        />
      {/if}
      {label}
    </button>
  {/each}
</div>

<div class="tab">
  <div class="py-3 px-3 border border-lime rounded-xl flex justify-between">
    <div>N</div>
    <TokenInput bind:this={input} bind:value={$inputValue$} decimals={24} />
    <button on:click={setMax}> max </button>
  </div>

  {#if walletConnected}
    <button
      class="w-full py-3 bg-lime text-black font-bold text-xl rounded-xl mt-3"
      on:click={() => runTx()}
      disabled={disabled || loading}>{active.label}</button
    >
  {:else}
    <slot />
  {/if}
  <div>
    <div class="pt-6">
      <div class="flex flex-col">
        <div class="flex items-center mb-3">
          <div>Near Balance</div>
        </div>
        <div class="w-full text-xl font-bold flex justify-evenly">
          <span class="flex-[1_1_1rem]">{nearBalance.format()}</span>
          {#if newNearBalance}
            <span in:fade>⇒</span>
            <span
              in:fade
              class="flex-[1_1_1rem] text-right"
              class:text-green-4={newNearBalance > nearBalance}
              class:text-red-4={newNearBalance < nearBalance}
            >
              {newNearBalance.format()}
            </span>
          {/if}
        </div>
      </div>
    </div>

    <div class="pt-6">
      <div class="flex flex-col">
        <div class="flex items-center mb-3">
          <div>Staked</div>
        </div>
        <div class="w-full text-xl font-bold flex">
          <span class="flex-[1_1_1rem]">{stake.format()}</span>
          {#if newStakeBalance}
            <span in:fade>⇒</span>
            <span
              in:fade
              class="flex-[1_1_1rem] text-right"
              class:text-green-4={newStakeBalance > stake}
              class:text-red-4={newStakeBalance < stake}
            >
              {newStakeBalance.format()}
            </span>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>
