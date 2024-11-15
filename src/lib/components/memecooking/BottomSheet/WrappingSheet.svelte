<script lang="ts">
  import { writable } from "svelte/store";
  import { BottomSheetContent } from "$lib/layout/BottomSheet";
  import { wallet, type TransactionCallbacks, nearBalance, wrappedNearBalance } from "$lib/near";
  import Near from "$lib/assets/Near.svelte";
  import { createTabs, melt } from "@melt-ui/svelte";
  import { crossfade, fade, slide } from "svelte/transition";
  import { match } from "ts-pattern"; 
  import { TokenInput, Button } from "$lib/components";
  import { FixedNumber } from "$lib/util";

  export let walletConnected: boolean;
  export let defaultTab: writable<string>;
  export let UpdateBalances: () => void;

  const [send, receive] = crossfade({
    duration: 300,
  });

  const {
    elements: { list, trigger },
    states: { value },
  } = createTabs({
    defaultValue: defaultTab,
  });

  let tabs: { label: "Wrap" | "Unwrap" }[] = [
    {
      label: "Wrap",
    },
    {
      label: "Unwrap",
    },
  ];
  $: active = { label: $value } as (typeof tabs)[number];

  let input: TokenInput;
  let inputValue$ = writable<string | undefined>();
  $: input$ = input?.u128$;

  $: if (active) {
    $inputValue$ = "";
  }

  let disabled = true;
  $: if ($input$?.valueOf() === 0n) {
    disabled = true;
  } else {
    disabled = false;
  }

  function setMax() {
    $inputValue$ = match(active.label)
      .with("Wrap", () => $nearBalance.sub(new FixedNumber(2n, 1)).toString())
      .with("Unwrap", () => Number($wrappedNearBalance).toFixed(24))
      .exhaustive();
  }
  
  async function handleWrappingButton() {
   const transactions: HereCall[] = [];

    const methodName = active.label === "Wrap" ? "near_deposit" : "near_withdraw";
    const args = methodName === "near_deposit" 
      ? {} 
      : { amount: $input$.toU128() };

    transactions.push({
      receiverId: import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID,
      actions: [
        {
          type: "FunctionCall",
          params: {
            methodName: methodName,
            args,
            gas: 30_000_000_000_000n.toString(),
            deposit: methodName === "near_deposit" ? $input$.toU128() : "1",
          },
        },
      ],
    });
    // Envia a transação
    await wallet.signAndSendTransactions(
      { transactions },
      {
        onSuccess: () => {
          UpdateBalances();
          $inputValue$ = "";
        },
        onFinally: () => {},
      },
    );
}

</script>

<BottomSheetContent variant="shitzu">
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
      <Near className="size-8" />
      <TokenInput
        class="bg-transparent focus:outline-none text-gray-300"
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
  </div>
  {#if walletConnected}
    <Button
      class="w-full py-3 mt-3 text-xl"
      onClick={handleWrappingButton}
      {disabled}
    >
      {active.label}
    </Button>
  {:else}
    <slot />
  {/if}
  <slot slot="header">
    <h2
      class="prose prose-invert prose-shitzu px-4 text-2xl font-bold text-shitzu-4"
    >
      Wrapping NEAR 
    </h2>
  </slot>
</BottomSheetContent>
