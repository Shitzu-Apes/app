<script lang="ts">
  import { onMount } from "svelte";

  import type { Meme } from "$lib/api/client";
  import ExtraDetail from "$lib/components/ExtraDetail.svelte";
  import { addToast } from "$lib/components/Toast.svelte";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import TradeTabs from "$lib/components/memecooking/Board/Desktop/TradeTabs.svelte";
  import McActionBox from "$lib/components/memecooking/Board/MCActionBox.svelte";
  import SocialLink from "$lib/components/memecooking/Board/SocialLink.svelte";
  import TokenChart from "$lib/components/memecooking/Board/TokenChart.svelte";
  import TokenHolder from "$lib/components/memecooking/Board/TokenHolder.svelte";
  import Chef from "$lib/components/memecooking/Chef.svelte";
  import Countdown from "$lib/components/memecooking/Countdown.svelte";
  import ProgressBar from "$lib/components/memecooking/ProgressBar.svelte";
  import { wallet } from "$lib/near";
  import { MCTradeSubscribe } from "$lib/store/memebids";
  import { FixedNumber } from "$lib/util";
  import { getTokenId } from "$lib/util/getTokenId";
  import { projectedMCap } from "$lib/util/projectedMCap";
  import { shareWithReferral } from "$lib/util/referral";

  $: mcap = projectedMCap(meme);
  export let meme: Meme;
  export let requiredStake: FixedNumber;
  const { accountId$ } = wallet;

  const MCSymbol = Symbol();
  onMount(() => {
    MCTradeSubscribe(MCSymbol, (data) => {
      if (data.meme_id === meme.meme_id) {
        meme = data;
      }
    });
  });
</script>

<div class="flex px-2 gap-2">
  <div class="flex-grow">
    <div class="w-full my-8">
      <ProgressBar
        progress={new FixedNumber(meme.total_deposit, 24)
          .div(requiredStake)
          .toNumber()}
      />
    </div>
    <div class="w-full flex items-center gap-3 my-2 text-sm">
      <span>
        {meme.name}
      </span>
      <span class="font-semibold whitespace-nowrap">
        ticker: {meme.symbol}
      </span>
      <div class="text-green-400 flex items-center gap-1 flex-wrap">
        Market cap:{" "}
        <span class="font-semibold flex items-center gap-1">
          ${$mcap.format({
            maximumFractionDigits: 1,
          })}{" "}
          <Tooltip
            info="total supply {new FixedNumber(
              meme.total_supply,
              meme.decimals,
            ).format()} {meme.symbol}"
          >
            <div class="i-mdi:information-outline size-4 text-green-4" />
          </Tooltip>
        </span>
      </div>
      {#if meme.pool_id}
        <div class="flex items-center justify-end text-right">
          <span>CA:</span>
          <div
            class="flex items-center justify-end text-right border border-white/25 rounded overflow-hidden ml-2 text-xs"
          >
            <span class="bg-dark-8 text-white px-1 py-1">
              {getTokenId(meme.symbol, meme.meme_id)}
            </span>
            <button
              class="bg-dark-6 text-white px-2 py-1"
              on:click={() => {
                navigator.clipboard.writeText(
                  getTokenId(meme.symbol, meme.meme_id),
                );
                addToast({
                  data: {
                    type: "simple",
                    data: {
                      title: "Copied",
                      description: "CA copied to clipboard!",
                      color: "green",
                    },
                  },
                });
              }}
            >
              copy
            </button>
          </div>
        </div>
      {/if}
      <div
        class="ml-auto flex items-center flex-wrap justify-end text-right gap-1"
      >
        <span class="whitespace-nowrap">created by</span>
        <Chef
          account={meme.owner}
          asLink
          class="bg-shitzu-3 text-black px-1 rounded"
        />
      </div>
    </div>
    <div class="w-full aspect-ratio-16/9 max-h-[75vh]">
      <TokenChart memebid={meme} />
    </div>
    <div class="w-full h-screen">
      <TradeTabs {meme} />
    </div>
  </div>

  <div class="w-90 max-w-1/3 p-2 flex flex-col gap-5">
    <div class="self-end flex items-center gap-2">
      <a
        class="hover:font-bold"
        href="https://t.me/bettearbot?start=ref-28757995"
        target="_blank"
        rel="noopener noreferrer"
      >
        [alerts]
      </a>
      <button
        class="hover:font-bold"
        on:click={() => shareWithReferral($accountId$, meme)}
      >
        [share]
      </button>
    </div>
    {#if meme.pool_id}
      <div
        class="flex gap-3 mt-10 bg-[rgba(0,214,175,1)] text-black p-3 rounded-lg font-medium"
      >
        Trade on Ref via Meme.Cooking
      </div>
    {:else if meme.end_timestamp_ms}
      <Countdown
        class="mx-auto text-shitzu-4 mb-10 justify-evenly w-full max-w-xl mt-10"
        to={meme.end_timestamp_ms}
      />
    {/if}
    <div class="w-full min-h-74 border-2 border-shitzu-4 rounded-xl p-2">
      <McActionBox {meme} />
    </div>

    <!-- Link -->
    <SocialLink
      twitterLink={meme.twitterLink || ""}
      telegramLink={meme.telegramLink || ""}
      website={meme.website || ""}
    />

    <!-- Token Detail -->
    <div class="w-full text-gray-3">
      <div class="flex gap-2">
        <img
          src="{import.meta.env.VITE_IPFS_GATEWAY}/{meme.image}"
          alt={meme.name}
          class="w-30 object-contain"
        />
        <div class="flex flex-col items-start">
          <h2>{meme.name} <b>(ticker: {meme.symbol})</b></h2>
          <div class="text-sm">{meme.description}</div>
        </div>
      </div>
      <ExtraDetail class="text-sm mt-3" {meme} />
    </div>

    <!-- Holder -->
    <div class="w-full">
      <TokenHolder {meme} />
    </div>
    <!-- End Right Nav -->
  </div>
</div>
