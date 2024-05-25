<script lang="ts">
  import { createCollapsible, melt } from "@melt-ui/svelte";
  import { FixedNumber } from "@tarnadas/fixed-number";
  import { writable } from "svelte/store";
  import { fade, slide } from "svelte/transition";
  import { bind } from "svelte-simple-modal";

  import { BuyNft, TokenStatistics } from ".";

  import type { AccountId } from "$lib/abi";
  import { ModalSize, modal$, modalSize$ } from "$lib/layout";
  import type { ValidatorFarm } from "$lib/near";
  import { getToken, getToken$, type TokenInfo } from "$lib/store";
  import { NFT_LINKS } from "$lib/components/BuyNft.svelte";
  import SHITZU_FACE from "$lib/assets/logo/shitzu_face.svg";

  export let farm: ValidatorFarm | null;
  export let undistributedRewards: [AccountId, string][] = [];
  export let totalStakers: number | null;
  export let totalStaked: FixedNumber | null;
  export let hasNft: boolean;

  let showNftApr = false;
  const tokenAPRs$ = writable<[number, TokenInfo][]>([]);
  let totalAPR: FixedNumber | null = null;
  let totalAPRDiff: FixedNumber | null = null;

  const near$ = getToken$("wrap.near");
  // hardcoding this to 9% * 0.75 for now
  const nearAPR = new FixedNumber(675n, 2);

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

  $: calculateTotalApr($tokenAPRs$, hasNft, showNftApr);

  async function calculateTotalApr(
    tokenAPRs: [number, TokenInfo][],
    hasNft: boolean,
    showNftApr: boolean,
  ) {
    const apr = tokenAPRs.reduce((acc, cur) => acc + cur[0], 0);
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

        return [apr, await getToken(tokenId)] as [number, TokenInfo];
      }),
    );
  }

  function handleOpenNftBuyDialog() {
    modalSize$.set(ModalSize.Small);
    modal$.set(bind(BuyNft, {}));
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
      <div class="flex flex-col items-end flex-[1_1_10rem]">
        <button
          class="flex itesm-center text-emerald"
          use:melt={$trigger}
          aria-label="Toggle"
        >
          <span>
            {#if totalAPR}
              {totalAPR.format({
                maximumFractionDigits: 2,
              })}%
            {/if}
            {#if totalAPRDiff && showNftApr && !hasNft}
              <span class="text-green-3" in:fade>
                (+{totalAPRDiff.format({
                  maximumFractionDigits: 2,
                })}%)
              </span>
            {/if}
          </span>
          <div>
            {#if $open}
              <div class="i-mdi-unfold-less-horizontal size-6" />
            {:else}
              <div class="i-mdi-unfold-more-horizontal size-6" />
            {/if}
          </div>
        </button>
        {#if $open}
          <div use:melt={$content} transition:slide>
            {#await getToken("wrap.near") then token}
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
                apr={new FixedNumber(String(Math.round(apr * 10_000)), 2)}
                {hasNft}
                {showNftApr}
              />
            {/each}
          </div>
        {/if}
      </div>
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
      <h2 class="text-base font-bold">APR Boost</h2>
      <div class="text-sm">
        SHITZU Revival NFT holders enjoy an additional boost of 25% on all
        <span class="font-bold">$DOGSHIT</span> claims.
      </div>

      <div class="flex justify-between items-center mt-5">
        <ul class="flex">
          {#each NFT_LINKS as { platform, logo }}
            <li class="first:pl-2 -ml-2">
              <img src={logo} alt={platform} class="w-9 h-9 rounded-full" />
            </li>
          {/each}
        </ul>
        <button
          class="bg-lime text-black font-bold text-sm rounded-lg px-5 py-2 flex items-center"
          on:click={handleOpenNftBuyDialog}
        >
          <img src={SHITZU_FACE} alt="SHITZU" class="w-6 h-6 -ml-2 mr-1" />
          Buy NFT
        </button>
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
