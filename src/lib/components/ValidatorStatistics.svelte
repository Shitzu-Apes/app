<script lang="ts">
  import { writable } from "svelte/store";
  import { fade } from "svelte/transition";

  import { TokenStatistics } from ".";
  import StakeNftBanner from "./Banner/StakeNFTBanner.svelte";

  import type { AccountId } from "$lib/abi";
  import { Near } from "$lib/assets";
  import { Dogshit, type PoolFarm } from "$lib/near";
  import { getToken, getToken$, type TokenInfo } from "$lib/store";
  import { FixedNumber } from "$lib/util";

  export let farm: PoolFarm | null;
  export let undistributedRewards: [AccountId, string][] = [];
  export let totalStakers: number | null;
  export let totalStaked: FixedNumber | null;
  export let hasStakedNft: boolean;

  let showNftApr = false;
  const tokenAPRs$ = writable<[number | null, TokenInfo][]>([]);
  let totalAPR: FixedNumber | null = null;
  let totalAPRDiff: FixedNumber | null = null;

  const near$ = getToken$("wrap.near");
  // hardcoding this to 9% * 0.75 for now
  const nearAPR = new FixedNumber(675n, 2);

  $: if (
    farm != null &&
    undistributedRewards != null &&
    totalStaked != null &&
    $near$ != null
  ) {
    fetchAPRs(farm, totalStaked, $near$);
  }

  $: calculateTotalApr($tokenAPRs$, hasStakedNft, showNftApr);

  async function calculateTotalApr(
    tokenAPRs: [number | null, TokenInfo][],
    hasNft: boolean,
    showNftApr: boolean,
  ) {
    const apr = tokenAPRs.reduce((acc, cur) => acc + (cur[0] ?? 0), 0);
    totalAPR = new FixedNumber(String(Math.round(apr * 10_000)), 2)
      .mul(
        hasNft || showNftApr ? new FixedNumber(1n, 0) : new FixedNumber(8n, 1),
      )
      .add(nearAPR);
    if (showNftApr && !hasNft) {
      totalAPRDiff = new FixedNumber(String(Math.round(apr * 10_000)), 2).mul(
        new FixedNumber(2n, 1),
      );
    } else {
      totalAPRDiff = null;
    }
  }

  async function fetchAPRs(
    farm: PoolFarm,
    totalStaked: FixedNumber,
    near: Promise<TokenInfo>,
  ) {
    const nearPrice = Number((await near).price);
    const now = Date.now() * 1_000_000;
    const yearlyMultiplier =
      Number(365n * 24n * 60n * 60n) /
      Number(
        (BigInt(farm.end_date) -
          BigInt(Math.max(now, Number(farm.start_date)))) /
          1_000_000_000n,
      );

    const yearlyShares = new FixedNumber("1200000000000000000000000000000", 24);
    const yearlySeconds = new FixedNumber(365n * 24n * 60n * 60n);
    const farmSeconds = new FixedNumber(
      (BigInt(farm.end_date) - BigInt(Math.max(now, Number(farm.start_date)))) /
        1_000_000_000n,
    );
    const sharesToBeDistributed = yearlyShares
      .mul(farmSeconds)
      .div(yearlySeconds);

    const validatorSupply = await Dogshit.balanceOf("shitzu.pool.near");
    const daoSupply = await Dogshit.balanceOf("shitzu.sputnik-dao.near");
    const undistributedMultiplier = sharesToBeDistributed
      .div(validatorSupply.add(daoSupply))
      .toNumber();

    $tokenAPRs$ = await Promise.all(
      undistributedRewards.map(async ([tokenId, rewards]) => {
        const { price, decimal } = await getToken(tokenId);

        if (price == null) {
          return [null, await getToken(tokenId)] as [null, TokenInfo];
        }
        const apr =
          (yearlyMultiplier *
            undistributedMultiplier *
            new FixedNumber(rewards, decimal).toNumber() *
            Number(price ?? 0)) /
          nearPrice /
          totalStaked.toNumber();

        return [apr, await getToken(tokenId)] as [number, TokenInfo];
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
    <div class="flex justify-between">
      <details
        class="w-full not-prose cursor-pointer [&_#fold]:open:block [&_#unfold]:open:hidden"
      >
        <summary
          class="w-full px-1 list-none marker:hidden transition duration-150 transition-ease-out"
        >
          <div class="flex w-full items-center justify-between text-left">
            <span>Annual percentage rate</span>
            <div class="flex items-end text-emerald">
              <div class="flex items-center">
                {#if totalAPR}
                  {totalAPR.format({
                    maximumFractionDigits: 2,
                  })}%
                {/if}
                {#if totalAPRDiff && showNftApr && !hasStakedNft}
                  <span class="text-green-3 ml-1" in:fade>
                    (+{totalAPRDiff.format({
                      maximumFractionDigits: 2,
                    })}%)
                  </span>
                {/if}
                <div id="unfold" class="i-mdi-unfold-more-horizontal size-6" />
                <div
                  id="fold"
                  class="i-mdi-unfold-less-horizontal size-6 hidden"
                />
              </div>
            </div>
          </div>
        </summary>
        <p class="px-2 py-3 text-sm text-gray-300 cursor-auto">
          {#await $near$ then token}
            <TokenStatistics
              icon="/assets/near.svg"
              {token}
              apr={nearAPR}
              hasNft={true}
            />
          {/await}
          {#each $tokenAPRs$ as [apr, token]}
            <TokenStatistics
              {token}
              apr={apr != null
                ? new FixedNumber(String(Math.round(apr * 10_000)), 2)
                : null}
              hasNft={hasStakedNft}
              {showNftApr}
            />
          {/each}
        </p>
      </details>
    </div>

    <div
      class="mt-2 bg-gradient-to-r bg-gradient-from-lime bg-gradient-to-emerald py-4 px-4 rounded-xl text-black flex flex-col not-prose"
      on:mouseenter={() => {
        showNftApr = true;
      }}
      on:mouseleave={() => {
        showNftApr = false;
      }}
      aria-label="APR Toggle"
      role="contentinfo"
    >
      <StakeNftBanner />
    </div>

    <div class="flex justify-between">
      <span>Total staked</span>
      <span>
        {#if totalStaked == null}
          -
        {:else}
          <div class="flex items-center gap-1">
            <Near className="size-6" />
            {totalStaked.format()}
          </div>
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
              .mul(
                new FixedNumber(BigInt(Math.trunc(Number(near.price) * 1e18))),
              )
              .div(new FixedNumber(BigInt(1e18)))
              .format()}
          {/if}
        </span>
      {/await}
    </div>
  </div>
</div>

<style>
  summary::-webkit-details-marker {
    display: none;
  }

  details summary {
    transition: margin 150ms ease-out;
  }

  details[open] summary {
    margin-bottom: 0.75rem;
  }
</style>
