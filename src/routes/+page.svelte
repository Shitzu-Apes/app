<script lang="ts">
  import { bind } from "svelte-simple-modal";

  import { DexscreenerIcon } from "$lib/assets";
  import { Dexscreener } from "$lib/components";
  import { ModalSize, modal$, modalSize$ } from "$lib/layout";
  import {
    refPrices$,
    shitzuPriceHistory,
    type ShitzuPriceHistory,
  } from "$lib/store";
  import Near from "$lib/assets/Near.svelte";
  import TokenInput from "$lib/components/TokenInput.svelte";

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

  $: nearPrice = $refPrices$["wrap.near"]?.price;

  export async function showPriceChart() {
    modalSize$.set(ModalSize.Large);
    modal$.set(bind(Dexscreener, {}));
  }
</script>

<div class="flex flex-col gap-[1.2rem]">
  <div>
    <div class="text-center">
      <h2 class="mb-0 text-4xl">SHITZU</h2>
      <div>Ref Finance Pool 4369</div>
      <div class="mt-6 text-center text-white text-3xl">
        {#if shitzuPrice && nearPrice}
          <div>
            ${parseFloat((shitzuPrice.price * +nearPrice).toString()).toFixed(
              6,
            )}
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
      <div class="flex items-center justify-center">
        <div class="text-4xl"><Near className="w-8 h-8" /></div>
        <TokenInput
          class="max-w-60 decoration-none bg-transparent outline-none text-center text-white text-6xl py-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          decimals={24}
          placeholder={"0"}
        />
        <div>
          <button class="bg-lime/15 text-lime px-4 py-2 rounded-xl">Max</button>
        </div>
      </div>

      <div class="text-center text-3xl">312,784.19 SHITZU</div>
    </div>

    {#if shitzuPrice && nearPrice}
      <div class="mt-6">
        <div class="text-sm font-bold flex items-center gap-1 mb-1">
          Buy SHITZU <div class="i-mdi:rocket-launch w-4 h-4 inline-flex" />
        </div>
        <div class="text-xs">
          You are buying <Near className="w-5 h-5 inline-flex align-middle" /> 10
          of SHITZU from
          <a
            href="https://app.ref.finance/v2farms/4369-r"
            target="_blank"
            rel="noopener noreferrer"
            class="decoration-none"
          >
            Ref Pool 4369
            <div class="i-mdi:open-in-new w-3 h-3 inline-flex items-center" />
          </a>. You will receive approximately 312,784.19 SHITZU based on the
          current price of ${parseFloat(
            (shitzuPrice.price * +nearPrice).toString(),
          ).toFixed(6)}.
        </div>
      </div>
    {/if}
    <button
      class="bg-lime text-black w-full py-2 rounded-xl my-6 text-2xl font-bold"
    >
      Buy
    </button>
  </div>

  <button
    on:click={showPriceChart}
    class="border-2 border-lime hover:bg-lime/15 flex justify-center items-center decoration-none px-4 py-2 rounded-xl"
  >
    <DexscreenerIcon className="w-4 h-4 mr-2" />
    Show Price Chart
  </button>
  <div class="mt-2 text-balance">
    Shitzu community is running a 50% fee validator with a staking farm that
    emits various meme tokens from the Near ecosystem. These meme tokens
    subsidize the staking fee. Due to the price fluctuations of the meme tokens
    this can result in much higher APRs. If you stake with our validator you
    will receive a token called $DOGSHIT, which wraps all underlying meme
    tokens. $DOGSHIT has no other purpose than being burnt to receive the
    underlying tokens.
  </div>
</div>
