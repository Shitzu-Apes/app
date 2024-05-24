<script lang="ts">
  import { Near } from "$lib/assets";
  import { TokenInput } from "$lib/components";
  import { nearBalance, refreshNearBalance, wallet } from "$lib/near";
  import {
    tokenPrices$,
    shitzuPriceHistory,
    type ShitzuPriceHistory,
  } from "$lib/store";
  import { calculateShitzuOut } from "$lib/swap";
  import { FixedNumber } from "@tarnadas/fixed-number";
  import { writable } from "svelte/store";

  $: shitzuPrice = $shitzuPriceHistory
    ? preparePrice($shitzuPriceHistory)
    : null;

  function preparePrice(priceHistory: ShitzuPriceHistory): {
    price: number;
    diff: number;
  } {
    const price =
      +priceHistory.price_list[priceHistory.price_list.length - 1].price;
    const yesterday = +priceHistory.price_list[0].price;
    const diff = (price - yesterday) / yesterday;
    return {
      price,
      diff,
    };
  }

  let input: TokenInput;
  let inputValue$ = writable<string | undefined>();
  $: input$ = input?.u128$;

  function setMax() {
    if ($nearBalance) {
      const input = $nearBalance.sub(new FixedNumber(5n, 1));
      $inputValue$ = input.toNumber().toFixed(4);
    }
  }

  $: nearPrice = $tokenPrices$ ? $tokenPrices$["wrap.near"].price : "0";

  const { accountId$ } = wallet;

  $: refreshNearBalance($accountId$);

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

      calculateShitzuOut($input$)
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
</script>

<div>
  <div class="text-center">
    <h2 class="mb-0 text-4xl">SHITZU</h2>
    <div>Ref Finance Pool 4369</div>
    <div class="mt-6 text-center text-white text-3xl">
      {#if shitzuPrice && nearPrice}
        <div>
          ${parseFloat((shitzuPrice.price * +nearPrice).toString()).toFixed(6)}
        </div>
        <div
          class="text-base"
          class:text-red={shitzuPrice.diff < 0}
          class:text-lime={shitzuPrice.diff > 0}
        >
          {shitzuPrice.diff < 0 ? "" : "+"}{parseFloat(
            (shitzuPrice.diff * 100).toString(),
          ).toFixed(2)}% TODAY
        </div>
      {:else}
        -
      {/if}
    </div>
  </div>

  <div>
    <div class="flex items-center justify-center w-full">
      <div class="text-4xl"><Near className="w-8 h-8" /></div>
      <TokenInput
        class="flex-1 max-w-70 decoration-none bg-transparent outline-none text-center text-white text-5xl py-10"
        bind:this={input}
        bind:value={$inputValue$}
        decimals={24}
        placeholder={"0"}
      />
      <div>
        <button
          on:click={setMax}
          class="bg-lime/15 text-lime px-4 py-2 rounded-xl">Max</button
        >
      </div>
    </div>

    {#if shitzuOut.status === "success"}
      <div class="text-center text-3xl">{shitzuOut.value.format()} SHITZU</div>
    {:else if shitzuOut.status === "loading"}
      <div class="i-svg-spinners:6-dots-rotate w-10 h-10 bg-lime mx-auto" />
    {/if}
  </div>

  {#if shitzuPrice && nearPrice && shitzuOut.status === "success" && $input$}
    <div class="mt-6">
      <div class="text-sm font-bold flex items-center gap-1 mb-1">
        Buy SHITZU <div class="i-mdi:rocket-launch w-4 h-4 inline-flex" />
      </div>
      <div class="text-xs">
        You are buying <Near className="w-5 h-5 inline-flex align-middle" />
        {$input$.format()} of SHITZU from
        <a
          href="https://app.ref.finance/v2farms/4369-r"
          target="_blank"
          rel="noopener noreferrer"
          class="decoration-none"
        >
          Ref Pool 4369
          <div class="i-mdi:open-in-new w-3 h-3 inline-flex items-center" />
        </a>. You will receive approximately {shitzuOut.value.format()} SHITZU based
        on the current price of ${parseFloat(
          (shitzuPrice.price * +nearPrice).toString(),
        ).toFixed(6)} with a maximum of 5% slippage.
      </div>
    </div>
  {/if}
  <button
    class="bg-lime text-black w-full py-2 rounded-xl my-6 text-2xl font-bold"
    on:click={() => {
      if (!$input$ || shitzuOut.status !== "success") return;

      const min_amount_out = shitzuOut.value
        .mul(new FixedNumber("95", 2))
        .div(new FixedNumber("100", 2))
        .toU128();

      const actions = [
        {
          pool_id: 4369,
          token_in: "wrap.near",
          amount_in: $input$.toU128(),
          token_out: "token.0xshitzu.near",
          min_amount_out,
        },
      ];

      wallet.signAndSendTransaction(
        {
          receiverId: "wrap.near",
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "near_deposit",
                args: {},
                gas: 30_000_000_000_000,
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
                    actions,
                  }),
                },
                gas: 270_000_000_000_000,
                deposit: "1",
              },
            },
          ],
        },
        {
          onSuccess: () => {
            refreshNearBalance($accountId$);
          },
          onFinally: () => {},
        },
      );
    }}
  >
    Buy
  </button>
</div>