<script lang="ts">
  import { createTabs, melt } from "@melt-ui/svelte";
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";
  import { writable } from "svelte/store";
  import { slide } from "svelte/transition";
  import { match } from "ts-pattern";

  import { addToast } from "../../Toast.svelte";

  import Near from "$lib/assets/Near.svelte";
  import { showWalletSelector } from "$lib/auth";
  import { Button } from "$lib/components";
  import TokenInput from "$lib/components/TokenInput.svelte";
  import MCRefSlippage from "$lib/components/memecooking/Board/MCRefSlippage.svelte";
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
    { id: "buy", label: "buy" },
    { id: "sell", label: "sell" },
  ] as const;

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
  $: {
    if (meme.pool_id) {
      const decimals = $value === "buy" ? 24 : meme.decimals;
      console.log("[$input$?.toString()]: ", $input$?.toU128());
      let amount = ($input$?.toBigInt() || 0n).toString();

      console.log("[amount]: ", amount);
      const amountIn = new FixedNumber(amount, decimals);
      if (amountIn.valueOf() > 0n) {
        let tokenIn, tokenOut;
        if ($value === "buy") {
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
          decimals: $value === "buy" ? meme.decimals : 24,
        }).then((value) => {
          console.log("[getReturn]: ", value);
          return value;
        });
      } else {
        expected = undefined;
      }
    }
  }

  const {
    elements: { root, list, trigger },
    states: { value },
  } = createTabs({
    defaultValue: "buy",
  });

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
            $value === "buy" ? 24 : meme.decimals,
          );
          const outAmount = new FixedNumber(
            log.split(" for ")[1].split(" ")[0],
            $value === "buy" ? meme.decimals : 24,
          );
          addToast({
            data: {
              type: "simple",
              data: {
                title: "Swap Success",
                description: `You successfully swapped ${inAmount.format({
                  compactDisplay: "short",
                  notation: "compact",
                })} ${$value === "buy" ? "NEAR" : meme.symbol} for ${outAmount.format(
                  {
                    compactDisplay: "short",
                    notation: "compact",
                    maximumFractionDigits: 3,
                  },
                )} ${$value === "buy" ? meme.symbol : "NEAR"}`,
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
    if ($value === "buy") {
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
    if ($value === "buy") {
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
          if (!$accountId$) return;
          match(tab.id)
            .with("buy", () => {
              refreshNearBalance($accountId$);
            })
            .with("sell", () => {
              refreshTokenBalance($accountId$);
            })
            .exhaustive();
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
        {#if $value === "buy"}
          <Near className="w-6 h-6 bg-white text-black rounded-full" />
        {:else}
          <img
            src="{import.meta.env.VITE_IPFS_GATEWAY}/{meme.image}"
            alt={meme.name}
            class="w-6 h-6 rounded-full"
          />
        {/if}
      </div>
      <TokenInput
        class="bg-transparent rounded-xl w-full py-6 text-center text-2xl px-14 appearance-none outline-none {$value ===
        'buy'
          ? 'text-shitzu-4'
          : 'text-rose-5'}"
        decimals={$value === "buy" ? 24 : meme.decimals}
        bind:this={input}
        bind:value={$inputValue$}
      />
      <div
        class="absolute inset-y-0 right-0 flex flex-col justify-center items-center pr-2 text-xs gap-1"
      >
        <div class="flex-grow basis-0" />
        <button
          class="text-sm cursor-pointer bg-gray-3 px-2 rounded-full border border-gray-6 {$value ===
          'buy'
            ? 'text-shitzu-7'
            : 'text-rose-5'}"
          on:click={setMax}
        >
          <div class="">Max</div>
        </button>
        <div
          class="{$value === 'buy'
            ? 'text-shitzu-4'
            : 'text-rose-4'} flex-grow basis-0"
        >
          {#if $value === "sell"}
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
          class="text-sm {$value === 'buy'
            ? 'bg-shitzu-8'
            : 'bg-rose-5'} px-1 rounded"
        >
          <button
            class="text-white {$value === 'buy'
              ? 'hover:text-shitzu-4'
              : 'hover:text-rose-2'} flex items-center gap-1"
            on:click={() => {
              if ($value === "buy") {
                $inputValue$ = new FixedNumber(
                  defaultValue[$value].value,
                  24,
                ).toString();
              } else {
                if ($tokenBalance == null) return;
                const bps = new FixedNumber(defaultValue[$value].value, 2);
                $inputValue$ = $tokenBalance.mul(bps).toString();
              }
            }}
          >
            {#if defaultValue[$value].value !== "0" && $value === "buy"}
              <Near className="size-4" />
            {/if}
            {defaultValue[$value].label}
          </button>
        </li>
      {/each}
    </ul>
    {#if expected != null}
      <div transition:slide class="text-sm text-white my-3 min-h-7">
        {#await expected}
          <div class="i-svg-spinners:pulse-3 size-4 my-3 ml-4" />
        {:then expected}
          {expected.format({
            notation: "compact",
            compactDisplay: "short",
          })}
          {#if $value === "buy"}
            {meme.symbol}
            <img
              src="{import.meta.env.VITE_IPFS_GATEWAY}/{meme.image}"
              alt={meme.name}
              class="inline size-5 rounded-full"
            />
          {:else}
            NEAR
            <Near className="inline size-5 bg-white text-black rounded-full" />
          {/if}
        {/await}
      </div>
    {/if}

    <label
      class="flex items-center space-x-2 mt-2 {$value === 'buy'
        ? 'invisible'
        : ''}"
    >
      <input type="checkbox" bind:checked={unwrapNear} />
      <span class="text-white">Unwrap wNEAR</span>
    </label>

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
      class="{$value === 'buy'
        ? 'bg-shitzu-4'
        : 'bg-rose-4'} w-full py-2 rounded text-xl tracking-wider text-black
        {$value === 'buy'
        ? 'border-shitzu-5'
        : 'border-rose-5'} active:translate-y-1 my-8"
    >
      [{$value}]
    </Button>
  </div>
</div>
