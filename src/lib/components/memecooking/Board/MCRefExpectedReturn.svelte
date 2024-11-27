<script lang="ts">
  import { debounce } from "perfect-debounce";
  import { createEventDispatcher } from "svelte";
  import { writable } from "svelte/store";
  import { slide } from "svelte/transition";
  import { match, P } from "ts-pattern";

  import type { Meme } from "$lib/api/client";
  import Near from "$lib/assets/Near.svelte";
  import McIcon from "$lib/components/MCIcon.svelte";
  import { Ref } from "$lib/near";
  import { FixedNumber } from "$lib/util";
  import { getTokenId } from "$lib/util/getTokenId";

  export let input$: FixedNumber | undefined;
  export let meme: Meme;
  export let activeTab: string;

  const dispatch = createEventDispatcher();

  const expected$ = writable<ReturnType<typeof fetchGetReturn> | undefined>(
    undefined,
  );

  const fetchGetReturn = debounce(
    (input: FixedNumber | undefined, meme: Meme, activeTab: string) => {
      if (meme.pool_id == null) return undefined as never;
      const decimals = activeTab === "buy" ? 24 : meme.decimals;
      let amount = (input?.toBigInt() || 0n).toString();

      const amountIn = new FixedNumber(amount, decimals);
      if (amountIn.valueOf() === 0n) {
        expected$.set(undefined);
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
      ]).then(([swapAmount, spotPrice]) => {
        const actualPrice = swapAmount.div(amountIn);
        const priceImpact = spotPrice.sub(actualPrice).div(spotPrice);

        const value = {
          amount: swapAmount,
          priceImpact: priceImpact.toNumber(),
        };

        dispatch("update", value);

        return value;
      });

      expected$.set(res);

      return res;
    },
    500,
  );

  $: fetchGetReturn(input$, meme, activeTab);

  $: pool = match(meme.pool_id)
    .with(P.nullish, () => Promise.resolve(null))
    .with(P.select(), (poolId) => Ref.getPool(poolId))
    .exhaustive();
</script>

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
              <McIcon {meme} class="w-6 h-6 rounded-full" />
              <span class="text-gray-300">{meme.symbol}</span>
            </div>
          {:else}
            <div class="flex items-center gap-1">
              <Near className="w-6 h-6 bg-white text-black rounded-full" />
              <span class="text-gray-300">NEAR</span>
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
            .div(input$ || new FixedNumber(1n, 24))
            .format({ maximumFractionDigits: 8 })}
          {activeTab === "buy" ? meme.symbol : "NEAR"}
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
