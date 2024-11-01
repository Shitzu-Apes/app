<script lang="ts">
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";
  import { writable } from "svelte/store";
  import { slide } from "svelte/transition";

  import { addToast } from "../../Toast.svelte";

  import Near from "$lib/assets/Near.svelte";
  import { showWalletSelector } from "$lib/auth";
  import { Button } from "$lib/components";
  import McIcon from "$lib/components/MCIcon.svelte";
  import ToggleSwitch from "$lib/components/ToggleSwitch.svelte";
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

  let unwrapNear: boolean = true;

  // Add slippage configuration
  let slippage: number = 0.05; // Default 5% slippage

  const tokenBalance = writable<FixedNumber | undefined>();
  $: if ($accountId$) {
    refreshTokenBalance($accountId$);
  }

  function refreshTokenBalance(accountId: string) {
    Ft.balanceOf(
      getTokenId(meme.symbol, meme.meme_id),
      accountId,
      meme.decimals,
    ).then((balance) => {
      $tokenBalance = balance;
    });
  }

  let expected: Promise<FixedNumber> | undefined = undefined;
  let activeTab = "buy";
  $: {
    if (meme.pool_id) {
      const decimals = activeTab === "buy" ? 24 : meme.decimals;
      console.log("[$input$?.toString()]: ", $input$?.toU128());
      let amount = ($input$?.toBigInt() || 0n).toString();

      console.log("[amount]: ", amount);
      const amountIn = new FixedNumber(amount, decimals);
      if (amountIn.valueOf() > 0n) {
        let tokenIn, tokenOut;
        if (activeTab === "buy") {
          tokenIn = import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID;
          tokenOut = getTokenId(meme.symbol, meme.meme_id);
        } else {
          tokenIn = getTokenId(meme.symbol, meme.meme_id);
          tokenOut = import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID;
        }

        expected = Ref.getReturn({
          amountIn,
          tokenOut,
          tokenIn,
          poolId: meme.pool_id,
          decimals: activeTab === "buy" ? meme.decimals : 24,
        }).then((value) => {
          console.log("[getReturn]: ", value);
          return value;
        });
      } else {
        expected = undefined;
      }
    }
  }

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
    if (expected == null) return;

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
      },
    };
    if (activeTab === "buy") {
      return handleBuy(
        $input$,
        $accountId$,
        await expected,
        meme,
        slippage,
        callback,
      );
    } else {
      return handleSell(
        $input$,
        $accountId$,
        await expected,
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
      sell: { value: "100", label: "100%" },
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
  <div class="px-3">
    <div class="relative my-6">
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
          class="text-sm cursor-pointer bg-gray-3 px-2 rounded-full border border-gray-6 {activeTab ===
          'buy'
            ? 'text-shitzu-7'
            : 'text-rose-5'}"
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
    {#if expected != null}
      <div transition:slide class="bg-gray-800 rounded-lg p-4 my-4">
        <div class="flex justify-between items-center text-sm">
          <span class="text-gray-400">You will receive</span>
          <div class="flex items-center gap-2">
            {#await expected}
              <div class="i-svg-spinners:pulse-3 size-4" />
            {:then expected}
              <span class="text-white font-medium">
                {expected.format({
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
                  <span class="text-gray-300">NEAR</span>
                </div>
              {/if}
            {/await}
          </div>
        </div>
        <div class="text-xs text-gray-500 mt-2">
          Rate: 1 {activeTab === "buy" ? "NEAR" : meme.symbol} ≈ {#await expected}...{:then expected}{expected
              .div($input$ || new FixedNumber(1n, 24))
              .format({ maximumFractionDigits: 8 })}
            {activeTab === "buy" ? meme.symbol : "NEAR"}{/await}
        </div>
      </div>
    {/if}

    <div
      class="{activeTab === 'buy'
        ? 'invisible'
        : ''} w-full flex items-center justify-between my-4"
    >
      <span class="text-white">Unwrap wNEAR</span>
      <ToggleSwitch
        bind:enabled={unwrapNear}
        on:toggle={() => {
          if (activeTab === "sell") {
            unwrapNear = !unwrapNear;
          }
        }}
      />
    </div>

    <MCRefSlippage
      bind:slippage
      on:update={handleSlippageUpdate}
      on:invalidSlippage={handleInvalidSlippage}
    />

    <Button
      onClick={async () => {
        await action();
        if (!$accountId$) return;
        await new Promise((resolve) => setTimeout(resolve, 5_000));
        refreshNearBalance($accountId$);
        updateMcAccount($accountId$);
      }}
      type="custom"
      disabled={$input$ == null || $input$.toNumber() == 0}
      class="{activeTab === 'buy'
        ? 'bg-shitzu-4'
        : 'bg-rose-4'} w-full py-2 rounded text-xl tracking-wider text-black
        {activeTab === 'buy'
        ? 'border-shitzu-5'
        : 'border-rose-5'} active:translate-y-1 my-8"
    >
      {activeTab === "buy" ? "Buy" : "Sell"}
      {meme.symbol}
    </Button>
  </div>
</div>
