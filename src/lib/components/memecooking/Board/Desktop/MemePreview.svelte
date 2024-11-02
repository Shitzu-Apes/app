<script lang="ts">
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";

  import McIcon from "$lib/components/MCIcon.svelte";
  import ActionButton from "$lib/components/memecooking/Board/Desktop/ActionButton.svelte";
  import ProgressBarSmall from "$lib/components/memecooking/Board/Desktop/ProgressBarSmall.svelte";
  import Chef from "$lib/components/memecooking/Chef.svelte";
  import Countdown from "$lib/components/memecooking/Countdown.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { memebids$ } from "$lib/store/memebids";
  import { FixedNumber } from "$lib/util";

  export let memebid: Meme;
  export let showCook = true;
  export let depositAmount: string | undefined = undefined;
  export let isOwnAccount: boolean = false;
  export let claimAmount: FixedNumber | undefined = undefined;
  export let quickActionAmount: string | undefined = undefined;
  export let update:
    | ((
        outcome: FinalExecutionOutcome | FinalExecutionOutcome[] | undefined,
      ) => void)
    | undefined = undefined;

  let isAnimating = false;

  $: {
    const firstMeme = $memebids$[0];
    if (firstMeme && firstMeme.meme_id === memebid.meme_id) {
      isAnimating = true;
      setTimeout(() => {
        isAnimating = false;
      }, 250);
    }
  }

  $: reachedMcap =
    new FixedNumber(memebid.total_deposit, 24) >=
    new FixedNumber(memebid.soft_cap, 24);
  $: isLaunched = typeof memebid.pool_id === "number";
  $: isEnded = Boolean(
    memebid.end_timestamp_ms && memebid.end_timestamp_ms < Date.now(),
  );
  $: status = isLaunched
    ? "launched"
    : isEnded
      ? reachedMcap
        ? "pending"
        : "failed"
      : "active";
  $: statusColor = {
    launched: "bg-shitzu-4 text-black",
    pending: "bg-amber-4 text-black",
    failed: "bg-rose-4 text-black",
    active:
      "bg-memecooking-400 text-black animated animated-heart-beat animated-infinite animated-duration-1000 hover:animate-none",
  }[status];

  const { projectedMcap } = memebid;
</script>

<div
  class="w-full rounded overflow-hidden hover:ring-2 hover:ring-shitzu-3 bg-gray-800 {isAnimating
    ? 'animated animated-shake animated-infinite animated-duration-250 border-2 border-memecooking-400'
    : ''}"
>
  <a
    href={`/meme/${memebid.meme_id >= 0 ? memebid.meme_id : memebid.token_id}`}
    class="block"
  >
    <div class="flex items-stretch">
      <!-- Image Section -->
      <div class="relative w-1/3 bg-white/20">
        <McIcon meme={memebid} class="w-full h-full object-contain" />
      </div>

      <div class="w-2/3 py-2 px-2 flex flex-col">
        <!-- Status Bar -->
        <div class="w-full flex justify-between items-center mb-2">
          <div class="w-full flex justify-between items-center gap-2">
            <span
              class={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${statusColor}`}
            >
              {#if status === "active"}
                {#if memebid.end_timestamp_ms}
                  <div class="flex items-center gap-1 text-black">
                    <div class="i-mdi:clock" />
                    <Countdown
                      class="text-base"
                      to={memebid.end_timestamp_ms}
                      format="compact"
                    />
                  </div>
                {/if}
              {:else}
                {status.toUpperCase()}
              {/if}
            </span>
          </div>
          {#if !isEnded}
            <div class="flex items-center p-1 gap-2">
              {#if !isLaunched}
                <div class="flex-shrink-0 h-fit flex items-center">
                  <ProgressBarSmall meme={memebid} />
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Title -->
        <div class="">
          <h3 class="text-base font-medium">
            {memebid.name}
            <span class="text-shitzu-4">${memebid.symbol}</span>
          </h3>
        </div>

        <!-- Description -->
        <p class="text-sm text-gray-300 line-clamp-2 mb-2">
          {memebid.description}
        </p>

        {#if showCook}
          <div class="text-xs w-full flex mb-2 gap-1 items-center">
            <div class="flex-shrink-0">by</div>
            <Chef account={memebid.owner} class="font-medium" />
          </div>
        {/if}

        <!-- Stats -->
        <div class="flex items-center justify-between text-sm mt-auto">
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-1">
              <span class="text-memecooking-400">MC:</span>
              <span class="font-medium">
                {#if $projectedMcap}
                  ${$projectedMcap.format({
                    maximumFractionDigits: 1,
                    notation: "compact",
                  })}
                {:else}-{/if}
              </span>
            </div>
          </div>

          <div class="flex items-center gap-4">
            {#if typeof memebid.staker_count === "number"}
              <div class="flex items-center gap-1">
                <div class="i-mdi:account-multiple text-memecooking-400" />
                <span class="font-medium">{memebid.staker_count}</span>
              </div>
            {/if}
            {#if typeof memebid.replies_count === "number"}
              <div class="flex items-center gap-1">
                <div class="i-mdi:comment text-memecooking-400" />
                <span class="font-medium">{memebid.replies_count}</span>
              </div>
            {/if}
          </div>
        </div>

        {#if quickActionAmount != undefined || depositAmount != undefined || (isOwnAccount && claimAmount && claimAmount.valueOf() > 0n) || !isEnded || isLaunched}
          <div class="mt-2 w-full">
            <!-- Actions -->
            <ActionButton
              {memebid}
              {depositAmount}
              {isOwnAccount}
              {claimAmount}
              {isEnded}
              {isLaunched}
              {quickActionAmount}
              {update}
            />
          </div>
        {/if}
      </div>
    </div>
  </a>
</div>
