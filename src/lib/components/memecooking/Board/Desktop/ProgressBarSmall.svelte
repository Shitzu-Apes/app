<script lang="ts">
  import type { Meme } from "$lib/api/client";
  import ExtraDetail from "$lib/components/ExtraDetail.svelte";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import { FixedNumber } from "$lib/util";

  export let meme: Meme;

  $: softCap = new FixedNumber(meme.soft_cap, 24);
  $: hardCap = meme.hard_cap ? new FixedNumber(meme.hard_cap, 24) : null;
  $: softHardCapRatio = hardCap ? softCap.div(hardCap).toNumber() : 0;
  $: totalDeposit = new FixedNumber(meme.total_deposit, 24);

  $: progress = hardCap
    ? totalDeposit.div(hardCap).toNumber()
    : totalDeposit.div(softCap).toNumber();
  $: softcapProgress = totalDeposit.div(softCap).toNumber();
  $: hardCapProgress = hardCap
    ? Number(
        ((totalDeposit.toBigInt() - softCap.toBigInt()) * 10000n) /
          (hardCap.toBigInt() - softCap.toBigInt()),
      ) / 10000
    : 0;
  console.log("[hardCapProgress]", hardCapProgress);
  $: animatedWidth = Math.min(progress, 1.05);
</script>

<Tooltip class="w-full">
  <slot slot="info">
    <ExtraDetail expanded class="w-80 p-2 text-sm" {meme} />
  </slot>

  {#if hardCap}
    <div class="flex items-center gap-1">
      <div
        class="h-1 bg-gray-3 relative border border-current {softcapProgress < 1
          ? 'text-red-5'
          : 'text-shitzu-4'}"
        style={`width: ${softHardCapRatio * 100}%`}
      >
        <div
          class="h-full bg-current absolute top-0 left-0 transition-width duration-2000 animate-ease-linear rounded-r-full"
          style={`width: ${(Math.min(softcapProgress, 1) * 100).toFixed(2)}%`}
        ></div>
      </div>
      <div
        class="w-full h-1 bg-gray-3 relative border border-current {softcapProgress <
        1
          ? 'text-red-5'
          : hardCapProgress > 0
            ? 'text-lime-4'
            : 'text-gray-3'}"
      >
        <div
          class="h-full bg-current absolute top-0 left-0 transition-width duration-2000 animate-ease-linear rounded-r-full"
          style={`width: ${(hardCapProgress * 100).toFixed(2)}%`}
        ></div>
      </div>
    </div>
  {:else}
    <div
      class="w-full h-1 bg-gray-3 relative border border-current {BigInt(
        meme.total_deposit,
      ) < BigInt(meme.soft_cap ?? 0)
        ? 'text-red-5'
        : BigInt(meme.total_deposit) >= BigInt(meme.soft_cap ?? 0)
          ? 'text-shitzu-4'
          : 'text-lime-4'}"
    >
      <div
        class="h-full bg-current absolute top-0 left-0 transition-width duration-2000 animate-ease-linear rounded-r-full"
        style={`width: ${animatedWidth * 100}%`}
      ></div>
    </div>
  {/if}
</Tooltip>
