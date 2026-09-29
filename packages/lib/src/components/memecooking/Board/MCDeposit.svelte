<script lang="ts">
  import { onDestroy } from "svelte";
  import { writable } from "svelte/store";
  import { match, P } from "ts-pattern";

  import McDepositButton from "./MCDepositButton.svelte";
  import McWithdrawButton from "./MCWithdrawButton.svelte";
  import Tabs from "./Tabs.svelte";

  import { useMcMemeDepositQuery } from "$lib/api/queries";
  import { useFtBalanceQuery } from "$lib/api/queries/balance";
  import Near from "$lib/assets/Near.svelte";
  import TokenInput from "$lib/components/TokenInput.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { nearBalance } from "$lib/near";
  import { FixedNumber } from "$lib/util";

  const tabs = [
    { id: "deposit", label: "Deposit" },
    { id: "withdraw", label: "Withdraw" },
  ];

  let activeTab = "deposit";

  export let accountId: string;

  let input: TokenInput;
  $: input$ = input?.u128$;
  let inputValue$ = writable<string | undefined>();

  export let meme: Meme;

  let returnTab = writable<string>("near");

  const depositAmount$ = useMcMemeDepositQuery(accountId, meme.meme_id);

  $: isFailed = !!(
    meme.total_deposit &&
    meme.soft_cap &&
    BigInt(meme.total_deposit) < BigInt(meme.soft_cap)
  );
  $: finished =
    meme.end_timestamp_ms != null && meme.end_timestamp_ms < Date.now();
  $: notStarted =
    meme.start_timestamp_ms != null &&
    Number(meme.start_timestamp_ms) > Date.now();
  $: console.log({ finished, notStarted, isFailed });
  $: disabled = finished || notStarted;

  const timer = setInterval(() => {
    finished =
      meme.end_timestamp_ms != null && meme.end_timestamp_ms < Date.now();
    notStarted =
      meme.start_timestamp_ms != null &&
      Number(meme.start_timestamp_ms) > Date.now();
  }, 1_000);

  onDestroy(() => {
    clearInterval(timer);
  });

  let totalNearBalance$ = writable<FixedNumber | null>($nearBalance);
  const wrapNearBalance$ = useFtBalanceQuery(
    import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!,
    accountId,
    24,
  );
  $: if (accountId && $nearBalance && $wrapNearBalance$.data) {
    totalNearBalance$.set($nearBalance.add($wrapNearBalance$.data));
  }

  $: hasEnoughTokens = match([
    activeTab,
    [$input$, $depositAmount$, $totalNearBalance$],
  ])
    .with(
      ["deposit", P.select()],
      ([input, _, amount]) =>
        amount != null &&
        input != null &&
        input.toBigInt() <= amount.toBigInt(),
    )
    .with(
      ["withdraw", P.select()],
      ([input, amount]) =>
        amount?.data?.amount != null &&
        input != null &&
        input.toBigInt() <= amount.data.amount.toBigInt(),
    )
    .otherwise(() => false);

  function setMax() {
    if (activeTab === "deposit") {
      if ($totalNearBalance$) {
        let input = $totalNearBalance$.sub(new FixedNumber(5n, 1));

        input = input.toNumber() < 0 ? new FixedNumber(0n, 24) : input;

        $inputValue$ = input.toString();
      }
    } else {
      if (!$depositAmount$?.data?.amount) {
        return;
      }
      $inputValue$ = $depositAmount$.data.amount.toString();
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
  <div class="w-full px-3 mt-6 flex flex-col gap-4">
    <div class="relative my-4">
      <div class="absolute inset-y-0 left-0 flex items-center pl-2">
        <Near className="w-6 h-6 bg-white text-black rounded-full" />
      </div>
      <TokenInput
        class="bg-transparent rounded-xl w-full py-6 text-center text-2xl px-14 appearance-none outline-none {activeTab ===
        'deposit'
          ? 'text-shitzu-4'
          : 'text-rose-5'}"
        decimals={24}
        readonly={disabled}
        bind:this={input}
        bind:value={$inputValue$}
      />
      <div
        class="absolute inset-y-0 right-0 flex flex-col justify-center items-center pr-2 text-xs gap-1"
      >
        <div class="flex-grow basis-0" />
        <button
          class="text-sm cursor-pointer px-2 py-0.5 rounded-md {activeTab ===
          'deposit'
            ? 'bg-shitzu-7'
            : 'bg-rose-5'} text-white"
          on:click={setMax}
          {disabled}
        >
          <div class="">Max</div>
        </button>
        <div
          class="{activeTab === 'deposit'
            ? 'text-shitzu-4'
            : 'text-rose-4'} flex-grow basis-0"
        >
          {#if activeTab === "withdraw"}
            {#if $depositAmount$?.data?.amount}
              {$depositAmount$.data.amount.format()}
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
                if (!$depositAmount$?.data?.amount) return;
                const bps = new FixedNumber(defaultValue[activeTab].value, 2);
                $inputValue$ = $depositAmount$.data.amount.mul(bps).toString();
              }
            }}
            {disabled}
          >
            {#if defaultValue[activeTab].value !== "0" && activeTab === "deposit"}
              <Near className="size-4" />
            {/if}
            {defaultValue[activeTab].label}
          </button>
        </li>
      {/each}
    </ul>

    {#if activeTab === "withdraw"}
      <div class="w-full flex justify-between">
        <span class="text-memecooking-400 text-sm"> Receive as </span>
        <Tabs
          tabs={[
            { id: "near", label: "NEAR" },
            { id: "wnear", label: "wNEAR" },
          ]}
          bind:activeTab={$returnTab}
          class="flex-shrink-0"
          tabClass="!py-0.5 min-w-16 text-sm"
          on:change={(e) => {
            $returnTab = e.detail;
          }}
        />
      </div>
    {/if}
    {#if activeTab === "deposit"}
      <McDepositButton
        {accountId}
        input={$input$ ?? new FixedNumber(0n, 24)}
        {disabled}
        {finished}
        hasEnoughTokens={hasEnoughTokens && !disabled}
        wrapNearBalance={wrapNearBalance$}
        {meme}
        onTransact={() => {
          $inputValue$ = "";
        }}
      />
    {:else}
      <McWithdrawButton
        {accountId}
        {meme}
        input={$input$ ?? new FixedNumber(0n, 24)}
        unwrapNear={true}
        {disabled}
        {finished}
        {isFailed}
        hasEnoughTokens={hasEnoughTokens && !disabled}
        depositAmount={$depositAmount$.data?.amount ?? new FixedNumber(0n, 24)}
        onTransact={() => {
          $inputValue$ = "";
        }}
      />
    {/if}
  </div>
</div>
