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
    <button
      class="w-full py-3 bg-lime text-black font-bold text-xl rounded-xl mt-3 disabled:bg-gray-5"
      on:click={handleOpenNftBuyDialog}
      on:mouseenter={() => {
        showNftApr = true;
      }}
      on:mouseleave={() => {
        showNftApr = false;
      }}
    >
      Buy NFT
    </button>

    <div use:melt={$root} class="flex justify-between">
      <span>Annual percentage rate</span>
      <div class="flex flex-col items-end flex-[1_1_10rem]">
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
        <button use:melt={$trigger} aria-label="Toggle">
          {#if $open}
            <div class="i-mdi-chevron-double-up size-6" />
          {:else}
            <div class="i-mdi-chevron-double-down size-6" />
          {/if}
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
