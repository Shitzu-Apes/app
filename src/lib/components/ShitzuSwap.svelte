<script lang="ts">
  import type { Transaction } from "@near-wallet-selector/core";
  import { writable } from "svelte/store";

  import {
    usePriceHistoryQuery,
    type ShitzuPriceHistory,
  } from "$lib/api/queries/priceHistory";
  import { useShitzuBalanceQuery } from "$lib/api/queries/shitzuBalance";
  import { useCurrentShitzuPriceQuery } from "$lib/api/queries/tokenPrice";
  import { Near } from "$lib/assets";
  import SHITZU_LOGO from "$lib/assets/logo/shitzu.webp";
  import { ConnectWallet } from "$lib/auth";
  import { DayPriceChart } from "$lib/components";
  import { TokenInput } from "$lib/components";
  import {
    Ft,
    Ref,
    nearBalance,
    refreshNearBalance,
    nearWallet,
  } from "$lib/near";
  import { FixedNumber } from "$lib/util";

  // Use price history query
  $: priceHistoryQuery = usePriceHistoryQuery("token.0xshitzu.near");

  // Use the current price query
  $: currentPriceQuery = useCurrentShitzuPriceQuery();

  $: shitzuStat =
    $priceHistoryQuery.data && $currentPriceQuery.data
      ? preparePrice($priceHistoryQuery.data, $currentPriceQuery.data)
      : null;

  function preparePrice(
    priceHistory: ShitzuPriceHistory,
    currentShitzuPrice: string,
  ): {
    diff: number;
  } {
    const price = +currentShitzuPrice;
    const yesterday = +priceHistory.price_list[0].price;
    const diff = (price - yesterday) / yesterday;
    return {
      diff,
    };
  }

  let input: TokenInput;
  let inputValue$ = writable<string | undefined>();
  $: input$ = input?.u128$;

  let displayPrice: {
    price: number;
    hoursAgo: number;
  } | null = null;

  function setMax() {
    if ($nearBalance) {
      let input = $nearBalance.sub(new FixedNumber(5n, 1));

      input = input.toNumber() < 0 ? new FixedNumber(0n, 24) : input;

      $inputValue$ = input.toNumber().toFixed(4);
    }
  }

  const { accountId$ } = nearWallet;

  // Use the shitzu balance query
  $: shitzuBalanceQuery = useShitzuBalanceQuery($accountId$ || "");

  let shitzuOut:
    | {
        value: null;
        status: "loading" | "error" | "idle";
      }
    | {
        value: FixedNumber;
        status: "success";
      } = {
    value: null,
    status: "idle",
  };

  $: {
    if ($input$) {
      shitzuOut = {
        value: null,
        status: "loading",
      };

      Ref.calculateShitzuOut($input$)
        .then((res) => {
          shitzuOut = {
            value: res,
            status: "success",
          };
        })
        .catch(() => {
          shitzuOut = {
            value: null,
            status: "error",
          };
        });
    }
  }

  async function handleSwap() {
    if (!$input$ || shitzuOut.status !== "success" || !$accountId$) return;

    const isRegistered = await Ft.isUserRegistered(
      "token.0xshitzu.near",
      $accountId$,
    );

    const min_amount_out = shitzuOut.value
      .mul(new FixedNumber("95", 2))
      .div(new FixedNumber("100", 2))
      .toU128();

    const transactions: Omit<Transaction, "signerId">[] = [];

    if (!isRegistered) {
      const deposit = await Ft.storageRequirement("token.0xshitzu.near");
      transactions.push({
        receiverId: "token.0xshitzu.near",
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: "storage_deposit",
              args: {},
              gas: 20_000_000_000_000n.toString(),
              deposit,
            },
          },
        ],
      });
    }

    transactions.push({
      receiverId: "wrap.near",
      actions: [
        {
          type: "FunctionCall",
          params: {
            methodName: "near_deposit",
            args: {},
            gas: 30_000_000_000_000n.toString(),
            deposit: $input$.toU128(),
          },
        },
        {
          type: "FunctionCall",
          params: {
            methodName: "ft_transfer_call",
            args: {
              receiver_id: "v2.ref-finance.near",
              amount: $input$.toU128(),
              msg: JSON.stringify({
                actions: [
                  {
                    pool_id: 4369,
                    token_in: "wrap.near",
                    amount_in: $input$.toU128(),
                    token_out: "token.0xshitzu.near",
                    min_amount_out,
                  },
                ],
              }),
            },
            gas: 270_000_000_000_000n.toString(),
            deposit: "1",
          },
        },
      ],
    });

    await nearWallet.signAndSendTransactions(
      { transactions },
      {
        onSuccess: () => {
          refreshNearBalance($accountId$);
          $shitzuBalanceQuery.refetch();
          $priceHistoryQuery.refetch();
          $currentPriceQuery.refetch();
        },
        onFinally: () => {},
      },
    );
  }
</script>

<div>
  <div>
    <!-- Show Shitzu Balance -->
    <a
      class="flex justify-between px-4 py-2 border border-lime rounded-full mt-4 mb-6 text-xs decoration-none"
      href="/account"
    >
      <div>Balance</div>
      <div class="flex items-center gap-2">
        {#if $shitzuBalanceQuery.isLoading}
          <div class="i-svg-spinners:6-dots-rotate w-3 h-3 bg-lime" />
        {:else if $shitzuBalanceQuery.isSuccess && $shitzuBalanceQuery.data}
          <div class="w-3 h-3 rounded-full bg-emerald" />
          <span>{$shitzuBalanceQuery.data.format()} SHITZU</span>
        {:else}
          -
        {/if}

        <div class="i-mdi:arrow-right w-3 h-3" />
      </div>
    </a>

    <!-- Show Shitzu Balance -->
  </div>

  <div class="text-center not-prose flex justify-between items-center">
    <div class="flex flex-col justify-start">
      <h2 class="mb-0 text-4xl text-start flex items-center">
        <img src={SHITZU_LOGO} alt="SHITZU" class="w-8 h-8 mr-2" />
        SHITZU
      </h2>
      <div>Ref Finance Pool 4369</div>
    </div>
    <div class="text-center text-white text-3xl text-end">
      {#if displayPrice}
        <div>
          ${displayPrice.price.toFixed(6)}
        </div>
        <div class="text-base text-white">
          {displayPrice.hoursAgo} hrs ago
        </div>
      {:else}
        {#if $currentPriceQuery.data}
          <div>
            ${parseFloat($currentPriceQuery.data).toFixed(6)}
          </div>
        {:else}
          <div class="i-svg-spinners:6-dots-rotate size-6 bg-lime mx-auto" />
        {/if}
        {#if shitzuStat}
          <div
            class="text-base"
            class:text-red={shitzuStat.diff < 0}
            class:text-lime={shitzuStat.diff > 0}
          >
            {shitzuStat.diff < 0 ? "" : "+"}{parseFloat(
              (shitzuStat.diff * 100).toString(),
            ).toFixed(2)}% TODAY
          </div>
        {:else}
          -
        {/if}
      {/if}
    </div>
  </div>

  <div class="relative w-full flex justify-center items-center">
    {#if $priceHistoryQuery.isLoading || !$currentPriceQuery.data}
      <div class="absolute i-svg-spinners:pulse w-10 h-10 bg-lime" />
    {/if}

    <DayPriceChart
      on:hover={({ detail }) => {
        if (detail) {
          displayPrice = detail;
        } else {
          displayPrice = null;
        }
      }}
      data={$priceHistoryQuery.data && $currentPriceQuery.data
        ? [
            ...$priceHistoryQuery.data.price_list.map((price) => ({
              x: price.date_time * 1000,
              y: parseFloat(price.price),
            })),
            {
              x: Date.now(),
              y: parseFloat($currentPriceQuery.data),
            },
          ]
        : []}
    />
  </div>

  <div>
    <div class="flex items-center justify-center">
      <div class="text-4xl"><Near className="w-8 h-8" /></div>
      <TokenInput
        class="flex-1 w-0 max-w-70 decoration-none bg-transparent outline-none text-center text-white text-5xl py-8"
        bind:this={input}
        bind:value={$inputValue$}
        decimals={24}
        placeholder={"0"}
      />
      <div class="relative">
        <button
          on:click={setMax}
          class="bg-lime/15 text-lime px-4 py-2 rounded-xl"
        >
          Max
        </button>
        {#if $nearBalance}
          <div
            class="absolute bottom-0 left-1/2 transform -translate-x-[50%] translate-y-[120%] text-xs text-center flex items-center"
          >
            <Near className="w-5 h-5" />
            {$nearBalance.format()}
          </div>
        {/if}
      </div>
    </div>

    {#if shitzuOut.status === "success"}
      <div class="text-center text-3xl">
        {shitzuOut.value.format()} SHITZU
      </div>
    {:else if shitzuOut.status === "loading"}
      <div class="i-svg-spinners:6-dots-rotate w-10 h-10 bg-lime mx-auto" />
    {/if}
  </div>

  {#if $currentPriceQuery.data && shitzuOut.status === "success" && $input$}
    <div class="mt-6">
      <div class="text-sm font-bold flex items-center gap-1 mb-1">
        Buy SHITZU <div class="i-mdi:rocket-launch w-4 h-4 inline-flex" />
      </div>
      <div class="text-xs">
        You are buying <Near className="w-5 h-5 inline-flex align-middle" />
        {$input$.format()} of SHITZU from
        <a
          href="https://{import.meta.env.VITE_REF_APP_URL}/v2farms/4369-r"
          target="_blank"
          rel="noopener noreferrer"
          class="decoration-none"
        >
          Ref Pool 4369
          <div class="i-mdi:open-in-new w-3 h-3 inline-flex items-center" />
        </a>. You will receive approximately {shitzuOut.value.format()} SHITZU based
        on the current price of ${parseFloat(
          $currentPriceQuery.data.toString(),
        ).toFixed(6)} with a maximum of 5% slippage.
      </div>
    </div>
  {/if}

  {#if $accountId$}
    <button
      class="bg-lime text-black w-full py-2 rounded-xl mt-4 mb-6 text-2xl font-bold disabled:bg-gray-5"
      disabled={$input$ == null || $input$.valueOf() === 0n}
      on:click={handleSwap}
    >
      Buy
    </button>
  {:else}
    <ConnectWallet />
  {/if}
</div>
