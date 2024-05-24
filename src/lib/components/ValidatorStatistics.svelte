<script lang="ts">
  import { createCollapsible, melt } from "@melt-ui/svelte";
  import { FixedNumber } from "@tarnadas/fixed-number";
  import { writable } from "svelte/store";
  import { slide } from "svelte/transition";

  import type { AccountId } from "$lib/abi";
  import type { ValidatorFarm } from "$lib/near";
  import { getToken, getToken$, type TokenInfo } from "$lib/store";

  export let farm: ValidatorFarm | null;
  export let undistributedRewards: [AccountId, string][] = [];
  export let totalStakers: number | null;
  export let totalStaked: FixedNumber | null;

  const tokenAPRs$ = writable<[AccountId, number][]>([]);

  const near$ = getToken$("wrap.near");

  const {
    elements: { root, content, trigger },
    states: { open },
  } = createCollapsible({
    forceVisible: true,
  });

  $: if (
    farm != null &&
    undistributedRewards != null &&
    totalStaked != null &&
    $near$ != null
  ) {
    fetchAPRs(farm, totalStaked, $near$);
  }

  async function fetchAPRs(
    farm: ValidatorFarm,
    totalStaked: FixedNumber,
    near: Promise<TokenInfo>,
  ) {
    const nearPrice = Number((await near).price);
    const yearlyMultiplier =
      Number(365n * 24n * 60n * 60n) /
      Number(
        (BigInt(farm.end_date) - BigInt(farm.start_date)) / 1_000_000_000n,
      );

    $tokenAPRs$ = await Promise.all(
      undistributedRewards.map(async ([tokenId, rewards]) => {
        const { price, decimal } = await getToken(tokenId);

        const apr =
          (yearlyMultiplier *
            new FixedNumber(rewards, decimal).toNumber() *
            Number(price ?? 0)) /
          nearPrice /
          totalStaked.toNumber();

        return [tokenId, apr] as [AccountId, number];
      }),
    );
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
    <div use:melt={$root} class="flex justify-between">
      <span>Annual percentage rate</span>
      <div class="flex flex-col items-end gap-2">
        <button use:melt={$trigger} aria-label="Toggle">
          {#if $open}
            <div class="i-mdi-chevron-double-up size-6" />
          {:else}
            <div class="i-mdi-chevron-double-down size-6" />
          {/if}
        </button>
        <!-- {JSON.stringify($tokenAPRs$, undefined, 2)} -->
        {#if $open}
          <div use:melt={$content} transition:slide>
            {#each $tokenAPRs$ as tokenAPR}
              <div class="rounded-lg p-3 shadow text-end">
                <span
                  >{tokenAPR[0]}
                  {new FixedNumber(
                    String(Math.round(tokenAPR[1] * 10_000)),
                    2,
                  ).format({
                    maximumFractionDigits: 2,
                  })}%</span
                >
              </div>
            {/each}
          </div>
        {/if}
      </div>
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
      {#await $near$}
        <div class="i-svg-spinners:6-dots-rotate size-6 bg-gray-8" />
      {:then near}
        <span>
          {#if totalStaked == null}
            <div class="i-svg-spinners:6-dots-rotate size-6 bg-gray-8" />
          {:else}
            ${totalStaked
              .mul(new FixedNumber(BigInt(Number(near.price) * 1e18)))
              .div(new FixedNumber(BigInt(1e18)))
              .format()}
          {/if}
        </span>
      {/await}
    </div>
  </div>
</div>
