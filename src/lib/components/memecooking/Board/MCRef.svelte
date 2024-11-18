<script lang="ts">
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";
  import { debounce } from "perfect-debounce";
  import { writable } from "svelte/store";
  import { slide } from "svelte/transition";

  import { addToast } from "../../Toast.svelte";

  import Near from "$lib/assets/Near.svelte";
  import { showWalletSelector } from "$lib/auth";
  import { Button } from "$lib/components";
  import McIcon from "$lib/components/MCIcon.svelte";
  import TokenInput from "$lib/components/TokenInput.svelte";
  import MCRefSlippage from "$lib/components/memecooking/Board/MCRefSlippage.svelte";
  import Tabs from "$lib/components/memecooking/Board/Tabs.svelte";
  import { closeBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import {
    Ft,
    nearBalance,
    Ref,
    refreshNearBalance,
    wallet,
    type TransactionCallbacks,
  } from "$lib/near";
  import { updateMcAccount } from "$lib/near/memecooking";
  import { fetchBlockHeight } from "$lib/near/rpc";
  import { handleBuy, handleSell } from "$lib/near/swap";
  import {
    awaitIndexerBlockHeight,
    awaitRpcBlockHeight,
  } from "$lib/store/indexer";
  import { FixedNumber } from "$lib/util";
  import { getTokenId } from "$lib/util/getTokenId";

  const tabs = [
    { id: "buy", label: "Buy" },
    { id: "sell", label: "Sell" },
  ];

  const { accountId$ } = wallet;

  let input: TokenInput;
  $: input$ = input?.u128$;
  let inputValue$ = writable<string | undefined>();

  export let meme: Meme;

  let returnTab = writable<string>("near");
  $: unwrapNear = $returnTab === "near";

  // Add slippage configuration
  let slippage: number = 0.05; // Default 5% slippage

  const tokenBalance = writable<FixedNumber | undefined>();
  $: if ($accountId$) {
    refreshTokenBalance($accountId$);
  }

  function refreshTokenBalance(accountId: string) {
    Ft.balanceOf(getTokenId(meme), accountId, meme.decimals).then((balance) => {
      $tokenBalance = balance;
    });
  }

  const expected$ = writable<ReturnType<typeof fetchGetReturn> | undefined>(
    new Promise<never>(() => {}),
  );
  let activeTab = "buy";
  $: {
    if (meme.pool_id) {
      const decimals = activeTab === "buy" ? 24 : meme.decimals;
      let amount = ($input$?.toBigInt() || 0n).toString();
      const amountIn = new FixedNumber(amount, decimals);
      if (amountIn.valueOf() === 0n) {
        $expected$ = undefined;
      }
    }
  }

  const fetchGetReturn = debounce(
    (input: FixedNumber | undefined, meme: Meme, activeTab: string) => {
      if (meme.pool_id == null) return undefined as never;
      const decimals = activeTab === "buy" ? 24 : meme.decimals;
      console.log("[input?.toString()]: ", input?.toU128());
      let amount = (input?.toBigInt() || 0n).toString();

      console.log("[amount]: ", amount);
      const amountIn = new FixedNumber(amount, decimals);
      if (amountIn.valueOf() === 0n) return undefined as never;
      let tokenIn, tokenOut;
      if (activeTab === "buy") {
        tokenIn = import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID;
        tokenOut = getTokenId(meme);
      } else {
        tokenIn = getTokenId(meme);
        tokenOut = import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID;
      }

      // Get both the return amount and price impact
      const res = Promise.all([
        Ref.getReturn({
          amountIn,
          tokenOut,
          tokenIn,
          poolId: meme.pool_id!,
          decimals: activeTab === "buy" ? meme.decimals : 24,
        }),
        // Get price for 1 token to calculate price impact
        Ref.getReturn({
          amountIn: new FixedNumber(1n * 10n ** BigInt(decimals), decimals),
          tokenOut,
          tokenIn,
          poolId: meme.pool_id!,
          decimals: activeTab === "buy" ? meme.decimals : 24,
        }),
      ]).then(([swapAmount, spotPrice]) => {
        console.log("[getReturn]: ", swapAmount);

        // Calculate price impact
        const actualPrice = swapAmount.div(amountIn);
        const priceImpact = spotPrice.sub(actualPrice).div(spotPrice);

        return {
          amount: swapAmount,
          priceImpact: priceImpact.toNumber(),
        };
      });

      $expected$ = res;
      return res;
    },
    500,
  );
  $: fetchGetReturn($input$, meme, activeTab);

  let totalNearBalance$ = writable($nearBalance);
  // let wrapNearBalance: FixedNumber | null = null;
  $: if ($accountId$ && $nearBalance) {
    Ft.balanceOf(
      import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID!,
      $accountId$,
      24,
    ).then((balance) => {
      // wrapNearBalance = balance;
      $totalNearBalance$ = $nearBalance.add(balance);
    });
  }

  async function action() {
    if ($expected$ == null) return;

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

    const callback: TransactionCallbacks<FinalExecutionOutcome[]> = {
      onSuccess: async (outcome) => {
        if (!outcome || !$accountId$) return;

        const refReceipt = outcome[outcome.length - 1].receipts_outcome.find(
          (outcome) =>
            outcome.outcome.executor_id ===
            import.meta.env.VITE_REF_CONTRACT_ID,
        );
        if (refReceipt != null) {
          const log = refReceipt.outcome.logs[0];
          const inAmount = new FixedNumber(
            log.split("Swapped ")[1].split(" ")[0],
            activeTab === "buy" ? 24 : meme.decimals,
          );
          const outAmount = new FixedNumber(
            log.split(" for ")[1].split(" ")[0],
            activeTab === "buy" ? meme.decimals : 24,
          );
          addToast({
            data: {
              type: "simple",
              data: {
                title: "Swap Success",
                description: `You successfully swapped ${inAmount.format({
                  compactDisplay: "short",
                  notation: "compact",
                })} ${activeTab === "buy" ? "NEAR" : meme.symbol} for ${outAmount.format(
                  {
                    compactDisplay: "short",
                    notation: "compact",
                    maximumFractionDigits: 3,
                  },
                )} ${activeTab === "buy" ? meme.symbol : "NEAR"}`,
              },
            },
            closeDelay: 8_000,
          });
        }
        closeBottomSheet();
        $inputValue$ = "";

        const blockHeight = await fetchBlockHeight(outcome);
        await Promise.all([
          awaitIndexerBlockHeight(blockHeight),
          awaitRpcBlockHeight(blockHeight),
        ]);
        refreshNearBalance($accountId$);
        refreshTokenBalance($accountId$);
        updateMcAccount($accountId$);
      },
    };
    if (activeTab === "buy") {
      return handleBuy(
        $input$,
        $accountId$,
        (await $expected$).amount,
        meme,
        slippage,
        callback,
      );
    } else {
      return handleSell(
        $input$,
        $accountId$,
        (await $expected$).amount,
        meme,
        unwrapNear,
        slippage,
        callback,
      );
    }
  }

  function setMax() {
    if (activeTab === "buy") {
      if ($totalNearBalance$) {
        let input = $totalNearBalance$.sub(new FixedNumber(5n, 1));

        input = input.toNumber() < 0 ? new FixedNumber(0n, 24) : input;

        $inputValue$ = input.toString();
      }
    } else {
      if (!$tokenBalance) {
        return;
      }
      $inputValue$ = $tokenBalance.toString();
    }
  }

  const defaultValues: {
    [key: string]: { value: string; label: string };
  }[] = [
    {
      buy: { value: "0", label: "reset" },
      sell: { value: "0", label: "reset" },
    },
    {
      buy: {
        value: 10_000_000_000_000_000_000_000_000n.toString(),
        label: "10",
      },
      sell: { value: "25", label: "25%" },
    },
    {
      buy: {
        value: 50_000_000_000_000_000_000_000_000n.toString(),
        label: "50",
      },
      sell: { value: "50", label: "50%" },
    },
    {
      buy: {
        value: 100_000_000_000_000_000_000_000_000n.toString(),
        label: "100",
      },
      sell: { value: "75", label: "75%" },
    },
  ];

  function handleSlippageUpdate(event: CustomEvent<number>) {
    slippage = event.detail;
  }

  function handleInvalidSlippage(
    event: CustomEvent<{ title: string; description: string }>,
  ) {
    addToast({
      data: {
        type: "simple",
        data: {
          title: event.detail.title,
          description: event.detail.description,
          color: "red",
        },
      },
    });
  }

  function handleTabChange(tabId: string) {
    activeTab = tabId;
    $inputValue$ = "";
    if (!$accountId$) return;
    if (tabId === "buy") {
      refreshNearBalance($accountId$);
    } else if (tabId === "sell") {
      refreshTokenBalance($accountId$);
    }
  }
</script>

<div class="w-full h-full flex flex-col justify-start items-center text-white">
  <Tabs
    {tabs}
    bind:activeTab
    on:change={(e) => handleTabChange(e.detail)}
    class="w-full mx-auto"
  />
  <div class="w-full px-3 mt-6 flex flex-col gap-4">
    <div class="relative my-2">
      <div class="absolute inset-y-0 left-0 flex items-center pl-2">
        {#if activeTab === "buy"}
          <Near className="w-6 h-6 bg-white text-black rounded-full" />
        {:else}
          <McIcon {meme} class="w-6 h-6 rounded-full" />
        {/if}
      </div>
      <TokenInput
        class="bg-transparent rounded-xl w-full py-6 text-center text-2xl px-14 appearance-none outline-none {activeTab ===
        'buy'
          ? 'text-shitzu-4'
          : 'text-rose-5'}"
        decimals={activeTab === "buy" ? 24 : meme.decimals}
        bind:this={input}
        bind:value={$inputValue$}
      />
      <div
        class="absolute inset-y-0 right-0 flex flex-col justify-center items-center pr-2 text-xs gap-1"
      >
        <div class="flex-grow basis-0" />
        <button
          class="text-sm cursor-pointer text-white px-2 py-0.5 rounded-md {activeTab ===
          'buy'
            ? 'bg-shitzu-7'
            : 'bg-rose-5'}"
          on:click={setMax}
        >
          <div class="">Max</div>
        </button>
        <div
          class="{activeTab === 'buy'
            ? 'text-shitzu-4'
            : 'text-rose-4'} flex-grow basis-0"
        >
          {#if activeTab === "sell"}
            {#if $tokenBalance != null}
              {$tokenBalance.format()}
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
          class="text-sm {activeTab === 'buy'
            ? 'bg-shitzu-8'
            : 'bg-rose-5'} px-1 rounded flex-1 basis-0 py-2"
        >
          <button
            class="text-white {activeTab === 'buy'
              ? 'hover:text-shitzu-4'
              : 'hover:text-rose-2'} flex justify-center items-center w-full gap-1"
            on:click={() => {
              if (activeTab === "buy") {
                $inputValue$ = new FixedNumber(
                  defaultValue[activeTab].value,
                  24,
                ).toString();
              } else {
                if ($tokenBalance == null) return;
                const bps = new FixedNumber(defaultValue[activeTab].value, 2);
                $inputValue$ = $tokenBalance.mul(bps).toString();
              }
            }}
          >
            {#if defaultValue[activeTab].value !== "0" && activeTab === "buy"}
              <Near className="size-4" />
            {/if}
            {defaultValue[activeTab].label}
          </button>
        </li>
      {/each}
    </ul>
    {#if $expected$ != null}
      <div transition:slide class="bg-gray-900 rounded-lg p-4">
        <div class="flex justify-between items-center text-sm">
          <span class="text-gray-400">Expected receive</span>
          <div class="flex items-center gap-2">
            {#await $expected$ then expected}
              <span class="text-white font-medium">
                {expected.amount.format({
                  notation: "standard",
                  maximumFractionDigits: 6,
                })}
              </span>
              {#if activeTab === "buy"}
                <div class="flex items-center gap-1">
                  <McIcon {meme} class="size-5 rounded-full" />
                  <span class="text-gray-300">{meme.symbol}</span>
                </div>
              {:else}
                <div class="flex items-center gap-1">
                  <Near className="size-5 bg-white text-black rounded-full" />
                  <span class="text-gray-300"
                    >{$returnTab === "near" ? "NEAR" : "wNEAR"}</span
                  >
                </div>
              {/if}
            {/await}
          </div>
        </div>
        <div class="text-xs flex justify-between mt-2">
          <span class="text-memecooking-400"
            >Rate: 1 {activeTab === "buy" ? "NEAR" : meme.symbol}</span
          >
          <span>
            {#await $expected$}
              <div class="i-svg-spinners:3-dots-scale size-4" />
            {:then expected}
              ≈ {expected.amount
                .div($input$ || new FixedNumber(1n, 24))
                .format({ maximumFractionDigits: 8 })}
              {activeTab === "buy" ? meme.symbol : "NEAR"}{/await}</span
          >
        </div>
        <div class="text-xs flex justify-between mt-2">
          <span class="text-memecooking-400">Price Impact:</span>
          {#await $expected$ then expected}
            <span
              class={expected.priceImpact > 0.05
                ? "text-rose-400"
                : "text-gray-400"}
            >
              {(expected.priceImpact * 100).toFixed(2)}%
            </span>
          {/await}
        </div>
      </div>
    {/if}

    <div class="flex flex-col w-full gap-1">
      {#if activeTab === "sell"}
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

      <MCRefSlippage
        bind:slippage
        on:update={handleSlippageUpdate}
        on:invalidSlippage={handleInvalidSlippage}
      />
    </div>

    <Button
      onClick={action}
      type="custom"
      disabled={$input$ == null || $input$.toNumber() == 0}
      class="{activeTab === 'buy'
        ? 'bg-shitzu-4'
        : 'bg-rose-4'} w-full py-2 rounded text-xl tracking-wider text-black
        {activeTab === 'buy'
        ? 'border-shitzu-5'
        : 'border-rose-5'} active:translate-y-1 my-4"
    >
      {activeTab === "buy" ? "Buy" : "Sell"}
      {meme.symbol}
    </Button>
  </div>
</div>
