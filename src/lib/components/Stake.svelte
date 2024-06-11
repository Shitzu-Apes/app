<script lang="ts">
  import { createTabs, melt } from "@melt-ui/svelte";
  import { writable } from "svelte/store";
  import { crossfade, fade, slide } from "svelte/transition";
  import { match } from "ts-pattern";

  import DogshitUndistributedReward from "./DogshitUndistributedReward.svelte";
  import MessageBox from "./MessageBox.svelte";

  import Near from "$lib/assets/Near.svelte";
  import { TokenInput, BurnTheShit, Button } from "$lib/components";
  import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import { wallet } from "$lib/near";
  import { memes, primaryNftTokenId, refreshPrimaryNftOf } from "$lib/store";
  import { FixedNumber } from "$lib/util";

  export let walletConnected: boolean;
  export let nearBalance: FixedNumber;
  export let stake: FixedNumber;
  export let afterUpdateBalances: () => void;

  const { accountId$ } = wallet;

  $: {
    if ($accountId$) {
      refreshPrimaryNftOf($accountId$);
    }
  }

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

  async function handleStakeButton() {
    if (!$input$ || $input$.valueOf() === 0n) return;
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
                gas: 30_000_000_000_000n.toString(),
                deposit: $input$.toU128(),
              }))
              .with("Unstake", () => ({
                methodName: "unstake",
                args: {
                  amount: $input$.toU128(),
                },
                gas: 30_000_000_000_000n.toString(),
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
      },
    );
  }

  function handleTrackDogShit() {
    openBottomSheet(DogshitUndistributedReward);
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
  <div
    class="py-3 px-3 border border-lime rounded-xl flex justify-between items-center"
  >
    <Near className="size-6" />
    <TokenInput
      class="bg-transparent focus:outline-none"
      bind:this={input}
      bind:value={$inputValue$}
      decimals={24}
    />
    <button
      on:click={setMax}
      class="bg-lime/15 text-lime px-4 py-2 rounded-lg text-sm"
    >
      Max
    </button>
  </div>

  {#if walletConnected}
    <Button
      class="w-full py-3 mt-3 text-xl"
      onClick={handleStakeButton}
      {disabled}
    >
      {active.label}
    </Button>
  {:else}
    <slot />
  {/if}

  <div>
    <div class="pt-6">
      <div class="flex flex-col">
        <div class="flex items-center mb-3">
          <div class="flex items-center gap-1">
            <div class="i-mdi:account-balance-wallet size-6" />
            Balance
          </div>
        </div>
        <div class="w-full text-xl font-bold flex justify-evenly">
          <span class="flex-[1_1_1rem] flex items-center gap-1 text-lime">
            <Near className="size-6" />
            {nearBalance.format()}
          </span>
          {#if newNearBalance}
            <span in:fade>⇒</span>
            <span
              in:fade
              class="flex-[1_1_1rem] flex justify-end items-center gap-1"
              class:text-green-4={newNearBalance > nearBalance}
              class:text-red-4={newNearBalance < nearBalance}
            >
              <Near className="size-6" />
              {newNearBalance.format()}
            </span>
          {/if}
        </div>
      </div>
    </div>

    <div class="pt-6">
      <div class="flex flex-col">
        <div class="flex items-center mb-3">
          <div class="flex items-center gap-1">
            <div class="i-mdi:lightning-bolt size-6" />
            Staked
          </div>
        </div>
        <div class="w-full text-xl font-bold flex">
          <span class="flex-[1_1_1rem] flex items-center gap-1 text-lime">
            <Near className="size-6" />
            {stake.format()}
          </span>
          {#if newStakeBalance}
            <span in:fade>⇒</span>
            <span
              in:fade
              class="flex-[1_1_1rem] flex justify-end items-center gap-1"
              class:text-green-4={newStakeBalance > stake}
              class:text-red-4={newStakeBalance < stake}
            >
              <Near className="size-6" />
              {newStakeBalance.format()}
            </span>
          {/if}
        </div>
      </div>
    </div>

    <div
      class="w-full py-3 text-black font-bold text-xl mt-3 border-t-2 border-lime"
    >
      <ul class="flex not-prose justify-center my-3">
        {#each memes as { name, src }}
          <li class="first:pl-2 -ml-2">
            <img {src} alt={name} class="w-9 h-9 rounded-full" />
          </li>
        {/each}
      </ul>
      <div class="text-sm flex justify-evenly mt-6 gap-2">
        <BurnTheShit class="text-sm rounded-lg" on:claimSuccess>
          Claim & burn the 💩
        </BurnTheShit>
        <button
          on:click={handleTrackDogShit}
          class="border-2 border-lime text-lime font-bold text-sm rounded-lg px-5 py-2 flex items-center decoration-none hover:bg-lime/15"
        >
          Track $DOGSHIT <div class="i-mdi:arrow-right size-5 ml-1" />
        </button>
      </div>
      <div class="text-amber text-xs mt-3">
        {#await $primaryNftTokenId then token}
          {#if !token}
            <MessageBox type="warning">
              You haven't staked an NFT and won't get 25% boost on your $DOGSHIT
              rewards
            </MessageBox>
          {/if}
        {/await}
      </div>
    </div>
  </div>
</div>
