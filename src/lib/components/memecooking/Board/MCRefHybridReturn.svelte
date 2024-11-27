<script lang="ts">
  import { debounce } from "perfect-debounce";
  import { createEventDispatcher } from "svelte";
  import { writable } from "svelte/store";
  import { slide } from "svelte/transition";
  import { match, P } from "ts-pattern";

  import type { Meme } from "$lib/api/client";
  import Near from "$lib/assets/Near.svelte";
  import SHITZU_LOGO from "$lib/assets/logo/shitzu.webp";
  import { Ref } from "$lib/near";
  import { FixedNumber } from "$lib/util";
  import { getTokenId } from "$lib/util/getTokenId";

  export let input$: FixedNumber | undefined;
  export let meme: Meme;
  export let activeTab: string;
  export let unwrapNear: boolean;

  const dispatch = createEventDispatcher();

  const expected$ = writable<ReturnType<typeof fetchGetReturn> | undefined>(
    undefined,
  );
  const shitzuPercentage = writable(0);
  const expectedShitzu$ = writable<FixedNumber | undefined>(undefined);
  const expectedNear$ = writable<FixedNumber | undefined>(undefined);
  const nearToShitzu$ = writable<FixedNumber | undefined>(undefined);

  const fetchGetReturn = debounce(
    async (
      input: FixedNumber | undefined,
      meme: Meme,
      activeTab: string,
      shitzuPct: number,
    ) => {
      if (meme.pool_id == null) return undefined as never;
      const decimals = activeTab === "buy" ? 24 : meme.decimals;
      let amount = (input?.toBigInt() || 0n).toString();

      const amountIn = new FixedNumber(amount, decimals);
      if (amountIn.valueOf() === 0n) {
        expected$.set(undefined);
        expectedShitzu$.set(undefined);
        expectedNear$.set(undefined);
        nearToShitzu$.set(undefined);
        dispatch("update", undefined);
        return undefined as never;
      }

      let tokenIn, tokenOut;
      if (activeTab === "buy") {
        tokenIn = import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID;
        tokenOut = getTokenId(meme);
      } else {
        tokenIn = getTokenId(meme);
        tokenOut = import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID;
      }

      const res = Promise.all([
        Ref.getReturn({
          amountIn,
          tokenOut,
          tokenIn,
          poolId: meme.pool_id!,
          decimals: activeTab === "buy" ? meme.decimals : 24,
        }),
        Ref.getReturn({
          amountIn: new FixedNumber(1n * 10n ** BigInt(decimals), decimals),
          tokenOut,
          tokenIn,
          poolId: meme.pool_id!,
          decimals: activeTab === "buy" ? meme.decimals : 24,
        }),
      ]).then(async ([swapAmount, spotPrice]) => {
        const actualPrice = swapAmount.div(amountIn);
        const priceImpact = spotPrice.sub(actualPrice).div(spotPrice);

        // Calculate SHITZU amount if percentage > 0
        let shitzuAmount;
        if (activeTab === "sell" && shitzuPct > 0) {
          const nearToShitzu = swapAmount.mul(
            new FixedNumber(shitzuPct.toString(), 2),
          );
          try {
            shitzuAmount = await Ref.getReturn({
              amountIn: nearToShitzu,
              tokenIn: import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID,
              tokenOut: import.meta.env.VITE_SHITZU_CONTRACT_ID,
              poolId: Number(import.meta.env.VITE_SHITZU_POOL_ID),
              decimals: 18,
            });
            expectedShitzu$.set(shitzuAmount);
            expectedNear$.set(swapAmount);
            nearToShitzu$.set(nearToShitzu);
          } catch (err) {
            console.error("Error calculating SHITZU return:", err);
          }
        } else {
          expectedNear$.set(swapAmount);
          nearToShitzu$.set(undefined);
        }

        const value = {
          amount: swapAmount,
          priceImpact: priceImpact.toNumber(),
          shitzuBuy:
            shitzuAmount && $nearToShitzu$
              ? {
                  amount: shitzuAmount,
                  nearAmount: $nearToShitzu$,
                }
              : undefined,
        };

        dispatch("update", value);
        return value;
      });

      expected$.set(res);
      return res;
    },
    500,
  );

  $: fetchGetReturn(input$, meme, activeTab, $shitzuPercentage);

  $: pool = match(meme.pool_id)
    .with(P.nullish, () => Promise.resolve(null))
    .with(P.select(), (poolId) => Ref.getPool(poolId))
    .exhaustive();
</script>

{#if $expected$ != null}
  <div transition:slide class="bg-gray-900 rounded-lg p-4">
    <div class="flex flex-col gap-2">
      <div class="flex justify-between items-center text-sm">
        <span class="text-gray-400">Expected receive</span>
        <div class="flex items-center gap-2">
          {#await $expectedNear$}
            <div class="i-svg-spinners:3-dots-scale size-4" />
          {:then nearAmount}
            {#if nearAmount}
              <span class="text-white font-medium">
                {nearAmount.format({
                  notation: "standard",
                  maximumFractionDigits: 6,
                })}
                {#if $nearToShitzu$}
                  (-{$nearToShitzu$.format({
                    notation: "standard",
                    maximumFractionDigits: 6,
                  })})
                {/if}
              </span>
              <div class="flex items-center gap-1">
                <Near className="w-6 h-6 bg-white text-black rounded-full" />
                <span class="text-gray-300"
                  >{activeTab === "sell" && !unwrapNear
                    ? "wNEAR"
                    : "NEAR"}</span
                >
              </div>
            {/if}
          {/await}
        </div>
      </div>
      {#if activeTab === "sell" && $shitzuPercentage > 0}
        <div class="flex justify-between items-center text-sm">
          <span class="text-gray-400"></span>
          <div class="flex items-center gap-2">
            {#await $expectedShitzu$}
              <div class="i-svg-spinners:3-dots-scale size-4" />
            {:then shitzuAmount}
              {#if shitzuAmount}
                <span class="text-white font-medium">
                  {shitzuAmount.format({
                    notation: "standard",
                    maximumFractionDigits: 6,
                  })}
                </span>
                <div class="flex items-center gap-1">
                  <img
                    src={SHITZU_LOGO}
                    class="w-6 h-6 rounded-full"
                    alt="SHITZU"
                  />
                  <span class="text-gray-300">SHITZU</span>
                </div>
              {/if}
            {/await}
          </div>
        </div>
      {/if}
    </div>

    {#if activeTab === "sell"}
      <div class="mt-4">
        <div class="flex justify-between text-xs text-memecooking-400 mb-2">
          <span>Convert to SHITZU</span>
          <span>{$shitzuPercentage}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="50"
          bind:value={$shitzuPercentage}
          class="w-full accent-shitzu-4"
        />
      </div>
    {/if}

    <div class="text-xs flex justify-between mt-2">
      <span class="text-memecooking-400"
        >Rate: 1 {activeTab === "buy" ? "NEAR" : meme.symbol}</span
      >
      <span>
        {#await $expected$}
          <div class="i-svg-spinners:3-dots-scale size-4" />
        {:then expected}
          ≈ {expected.amount
            .div(input$ || new FixedNumber(1n, 24))
            .format({ maximumFractionDigits: 8 })}
          {activeTab === "buy" ? meme.symbol : unwrapNear ? "NEAR" : "wNEAR"}
        {/await}
      </span>
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
    <div class="text-xs flex justify-between mt-2">
      <span class="text-memecooking-400">Pool Fee:</span>
      {#await pool then pool}
        {#if pool != null}
          <span class="text-gray-400">
            {(pool.total_fee / 100).toFixed(2)}%
          </span>
        {/if}
      {/await}
    </div>
  </div>
{/if}
