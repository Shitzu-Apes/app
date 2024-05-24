<script lang="ts">
  import { FixedNumber } from "@tarnadas/fixed-number";
  import { writable } from "svelte/store";

  import type { AccountId } from "$lib/abi";
  import type { ValidatorFarm } from "$lib/near";
  import { tokenPrices$ } from "$lib/store";

  export let farm: ValidatorFarm | null;
  export let undistributedRewards: [AccountId, string][] = [];
  export let totalStakers: number | null;
  export let totalStaked: FixedNumber | null;

  const tokenAPRs$ = writable<[AccountId, number][]>([]);

  $: nearPrice = $tokenPrices$ ? +$tokenPrices$["wrap.near"].price : 0;

  $: if (
    farm != null &&
    undistributedRewards != null &&
    totalStaked != null &&
    nearPrice != null &&
    $tokenPrices$ !== null
  ) {
    const yearlyMultiplier =
      Number(365n * 24n * 60n * 60n) /
      Number(
        (BigInt(farm.end_date) - BigInt(farm.start_date)) / 1_000_000_000n,
      );

    $tokenAPRs$ = undistributedRewards.map(([tokenId, rewards]) => {
      const { price, decimal } = $tokenPrices$[tokenId];

      const apr =
        (yearlyMultiplier *
          new FixedNumber(rewards, decimal).toNumber() *
          Number(price ?? 0)) /
        nearPrice /
        totalStaked.toNumber();

      return [tokenId, apr] as [AccountId, number];
    });
  }
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
      <span style="color: #b2ff59;">
        {JSON.stringify($tokenAPRs$, undefined, 2)}
      </span>
    </div>
    <div class="flex justify-between">
      <span>Total staked</span>
      <span>
        {#if totalStaked == null}
          -
        {:else}
          {totalStaked.format()} NEAR
        {/if}
      </span>
    </div>
    <div class="flex justify-between">
      <span>Stakers</span>
      <span>
        {#if totalStakers == null}
          -
        {:else}
          {totalStakers}
        {/if}
      </span>
    </div>
    <div class="flex justify-between">
      <span>Total staked USD</span>
      <span>
        {#if totalStaked == null || nearPrice == null}
          -
        {:else}
          ${totalStaked
            .mul(new FixedNumber(BigInt(nearPrice * 1e18)))
            .div(new FixedNumber(BigInt(1e18)))
            .format()}
        {/if}
      </span>
    </div>
  </div>
</div>
