<script lang="ts">
  import { onMount } from "svelte";

  import type { Meme } from "$lib/api/client";
  import ExtraDetail from "$lib/components/ExtraDetail.svelte";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import TradeTabs from "$lib/components/memecooking/Board/Desktop/TradeTabs.svelte";
  import McActionBox from "$lib/components/memecooking/Board/MCActionBox.svelte";
  import SocialLink from "$lib/components/memecooking/Board/SocialLink.svelte";
  import TokenChart from "$lib/components/memecooking/Board/TokenChart.svelte";
  import TokenHolder from "$lib/components/memecooking/Board/TokenHolder.svelte";
  import Chef from "$lib/components/memecooking/Chef.svelte";
  import Countdown from "$lib/components/memecooking/Countdown.svelte";
  import ProgressBar from "$lib/components/memecooking/ProgressBar.svelte";
  import { addToast } from "$lib/components/memecooking/Toast.svelte";
  import { wallet } from "$lib/near";
  import { MCTradeSubscribe } from "$lib/store/memebids";
  import { FixedNumber } from "$lib/util";
  import { getTokenId } from "$lib/util/getTokenId";
  import { projectedMCap } from "$lib/util/projectedMCap";

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
        <a
          href={`https://pikespeak.ai/wallet-explorer/${meme.owner}`}
          target="_blank"
          rel="noopener noreferrer"
          class="text-shitzu-4"
        >
          <Chef
            account={meme.owner}
            class="bg-shitzu-3 text-black px-1 rounded"
          />
        </a>
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
    <button
      class="self-end hover:font-bold"
      on:click={async () => {
        const shareUrl = new URL(
          `${window.location.origin}/meme/${meme.meme_id}`,
        );
        if ($accountId$) {
          shareUrl.searchParams.set("referral", $accountId$);
        }

        if (navigator.share) {
          try {
            await navigator.share({
              title: document.title,
              url: shareUrl.toString(),
            });
          } catch (error) {
            console.error("Error sharing:", error);
          }
        } else {
          try {
            await navigator.clipboard.writeText(shareUrl.toString());
            addToast({
              data: {
                type: "simple",
                data: {
                  title: "Success",
                  description: "Link copied to clipboard!",
                  color: "green",
                },
              },
            });
          } catch (error) {
            console.error("Error copying to clipboard:", error);
          }
        }
      }}
    >
      [share]
    </button>
    {#if meme.end_timestamp_ms}
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
          <h2>{meme.name} <b>(ticker: ${meme.symbol})</b></h2>
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
