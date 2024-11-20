<script lang="ts">
  import Near from "$lib/assets/Near.svelte";
  import McIcon from "$lib/components/MCIcon.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { FixedNumber } from "$lib/util";

  export let meme: Meme;

  let className: string = "";
  export { className as class };
  $: totalSupply = new FixedNumber(meme.total_supply, meme.decimals);
  $: totalDeposit = new FixedNumber(BigInt(meme.total_deposit!), 24);
  $: softCap = new FixedNumber(meme.soft_cap ?? "0", 24);
  $: hardCap = new FixedNumber(meme.hard_cap ?? "0", 24);
  $: hardCapEnabled = BigInt(meme.hard_cap ?? "0") > 0n;

  // Calculate team allocation percentage
  $: teamAllocationBps =
    BigInt(meme.team_allocation ?? "0") && BigInt(meme.total_supply ?? "0")
      ? (BigInt(meme.team_allocation ?? "0") /
          BigInt(meme.total_supply ?? "0")) *
        10000n
      : 0n;
  $: teamAllocationPercentage = Number(teamAllocationBps) / 100;

  // Delta for splitting NEAR between liquidity pool and token holders
  $: delta = 1 / 1.98;
  $: liquidityPoolShare = delta * (1 - teamAllocationPercentage / 100);
  $: tokenHolderShare = (1 - delta) * (1 - teamAllocationPercentage / 100);
</script>

<div class="{className} overflow-hidden">
  <div class="space-y-6">
    <!-- Launch Conditions -->
    <div class="">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-medium">Launch Conditions</h3>
      </div>

      <div class="flex items-center gap-2 text-gray-400 mt-4">
        <Near className="size-6 bg-white rounded-full text-black" />
        <span class="text-sm">All amounts in NEAR</span>
      </div>

      <div class="flex flex-col gap-4 mt-4">
        {#if !meme.pool_id}
          <div class="flex items-center gap-1">
            <span class="w-6 flex justify-center flex-shrink-0">
              <div class="i-mdi:cash text-memecooking-400" />
            </span>
            <span class="text-memecooking-400 text-sm font-medium"
              >Current Deposits:</span
            >
            <span class="font-medium ml-auto">{totalDeposit.format()}</span>
          </div>
        {/if}

        <div class="flex items-center gap-1">
          <span class="w-6 flex justify-center flex-shrink-0">
            <div class="i-mdi:flag text-memecooking-400" />
          </span>
          <span class="text-memecooking-400 text-sm font-medium">Soft Cap:</span
          >
          <span class="font-medium ml-auto">{softCap.format()}</span>
        </div>

        {#if hardCapEnabled}
          <div class="flex items-center gap-1">
            <span class="w-6 flex justify-center flex-shrink-0">
              <div class="i-mdi:flag-checkered text-memecooking-400" />
            </span>
            <span class="text-memecooking-400 text-sm font-medium"
              >Hard Cap:</span
            >
            <span class="font-medium ml-auto">{hardCap.format()}</span>
          </div>
        {/if}
      </div>
    </div>

    <!-- Token Supply Distribution -->
    <div class="">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-medium">Token Supply Distribution</h3>
      </div>

      <div class="flex items-center gap-2 text-gray-400 mt-4">
        <McIcon {meme} class="size-6 rounded-full" />
        <span class="text-sm">All amounts in {meme.symbol}</span>
      </div>

      <div class="flex flex-col gap-4 mt-4">
        <div class="flex items-center gap-1">
          <span class="w-6 flex justify-center flex-shrink-0">
            <div class="i-mdi:package text-memecooking-400" />
          </span>
          <span class="text-memecooking-400 text-sm font-medium"
            >Total Supply:</span
          >
          <span class="font-medium ml-auto">{totalSupply.format()}</span>
        </div>

        {#if teamAllocationPercentage > 0}
          <div class="flex items-center gap-1">
            <span class="w-6 flex justify-center flex-shrink-0">
              <div class="i-mdi:account-group text-memecooking-400" />
            </span>
            <span class="text-memecooking-400 text-sm font-medium">Team:</span>
            <span class="font-medium ml-auto">
              <span class="text-xs text-gray-400 mr-1"
                >({teamAllocationPercentage.toFixed(2)}%)</span
              >
              {totalSupply
                .mul(
                  new FixedNumber(
                    BigInt(Math.round(Number(teamAllocationBps))),
                    4,
                  ),
                )
                .format()}
            </span>
          </div>
        {/if}

        <div class="flex items-center gap-1">
          <span class="w-6 flex justify-center flex-shrink-0">
            <div class="i-mdi:pool text-memecooking-400" />
          </span>
          <span class="text-memecooking-400 text-sm font-medium">Pool:</span>
          <span class="font-medium ml-auto">
            <span class="text-xs text-gray-400 mr-1"
              >({(liquidityPoolShare * 100).toFixed(1)}%)</span
            >
            {totalSupply
              .mul(
                new FixedNumber(
                  BigInt(Math.round(liquidityPoolShare * 10000)),
                  4,
                ),
              )
              .format()}
          </span>
        </div>

        <div class="flex items-center gap-1">
          <span class="w-6 flex justify-center flex-shrink-0">
            <div class="i-mdi:account-multiple text-memecooking-400" />
          </span>
          <span class="text-memecooking-400 text-sm font-medium">Holders:</span>
          <span class="font-medium ml-auto">
            <span class="text-xs text-gray-400 mr-1"
              >({(tokenHolderShare * 100).toFixed(1)}%)</span
            >
            {totalSupply
              .mul(
                new FixedNumber(
                  BigInt(Math.round(tokenHolderShare * 10000)),
                  4,
                ),
              )
              .format()}
          </span>
        </div>
      </div>
    </div>
  </div>
</div>
