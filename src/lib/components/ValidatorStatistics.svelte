<script lang="ts">
  import { tokenPrice } from "$lib/store/tokenPrice";
  import { FixedNumber } from "@tarnadas/fixed-number";

  export let totalStakers$: number | null;
  export let totalStaked$: FixedNumber | null;

  $: nearPrice =
    "wrap.near" in $tokenPrice ? $tokenPrice["wrap.near"].price : null;
</script>

<div class="">
  <h3 class="flex justify-between items-baseline">
    <span>Statistics</span>
    <a
      href="https://nearscope.net/validator/shitzu.pool.near/tab/delegators"
      target="_blank"
      rel="noopener"
      class="text-sm text-right text-lime"
    >
      View on nearscope
    </a>
  </h3>
  <div
    class="border-2 border-lime px-4 py-6 rounded-xl flex flex-col gap-3 bg-black"
  >
    <div class="flex justify-between">
      <span>Annual percentage rate</span>
      <span style="color: #b2ff59;"> - </span>
    </div>
    <div class="flex justify-between">
      <span>Total staked</span>
      <span>
        {#if totalStaked$ == null}
          -
        {:else}
          {totalStaked$.format()} NEAR
        {/if}
      </span>
    </div>
    <div class="flex justify-between">
      <span>Stakers</span>
      <span>
        {#if totalStakers$ == null}
          -
        {:else}
          {totalStakers$}
        {/if}
      </span>
    </div>
    <div class="flex justify-between">
      <span>Total staked USD</span>
      <span>
        {#if totalStaked$ == null || nearPrice == null}
          -
        {:else}
          ${totalStaked$
            .mul(new FixedNumber(BigInt(+nearPrice * 1e18)))
            .div(new FixedNumber(BigInt(1e18)))
            .format()}
        {/if}
      </span>
    </div>
  </div>
</div>
