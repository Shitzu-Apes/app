<script lang="ts">
  import { onMount } from "svelte";

  import type { Meme } from "$lib/api/client";
  import Near from "$lib/assets/Near.svelte";
  import TradeTabs from "$lib/components/memecooking/Board/Desktop/TradeTabs.svelte";
  import McActionBox from "$lib/components/memecooking/Board/MCActionBox.svelte";
  import SocialLink from "$lib/components/memecooking/Board/SocialLink.svelte";
  import TokenChart from "$lib/components/memecooking/Board/TokenChart.svelte";
  import TokenHolder from "$lib/components/memecooking/Board/TokenHolder.svelte";
  import Chef from "$lib/components/memecooking/Chef.svelte";
  import Countdown from "$lib/components/memecooking/Countdown.svelte";
  import ProgressBar from "$lib/components/memecooking/ProgressBar.svelte";
  import { MCsubscribe } from "$lib/store/memebids";
  import { FixedNumber } from "$lib/util";

  export let meme: Meme;
  export let requiredStake: FixedNumber;

  const MCSymbol = Symbol();
  onMount(() => {
    MCsubscribe(MCSymbol, (data) => {
      if (data.meme_id === meme.meme_id) {
        meme = data;
      }
    });
  });
</script>

<div class="w-full flex">
  {#if meme.end_timestamp_ms}
    <Countdown
      class="mx-auto text-4xl text-shitzu-4 mb-10"
      to={meme.end_timestamp_ms}
    />
  {/if}
</div>
<div class="w-120 mx-auto mb-10">
  <ProgressBar
    progress={new FixedNumber(meme.total_deposit, 24)
      .div(requiredStake)
      .toNumber()}
  />
</div>
<div class="flex px-2 gap-2">
  <div class="flex-grow">
    <div class="w-full flex items-center gap-3 my-2 text-sm">
      <span>
        {meme.name}
      </span>
      <span class="font-semibold">
        ${meme.symbol}
      </span>
      <span class="text-green-400 flex items-center">
        Market cap:{" "}
        <Near className="size-4" />
        {new FixedNumber(BigInt(meme.total_deposit) * BigInt(2), 24).format()}
      </span>
      <span class="ml-auto flex items-center justify-end text-right gap-1">
        created by
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
      </span>
    </div>
    <div class="w-full aspect-ratio-21/9">
      <TokenChart memebid={meme} />
    </div>
    <div class="w-full h-screen">
      <TradeTabs {meme} />
    </div>
  </div>

  <div class="w-90 p-2 flex flex-col gap-5">
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
    <div class="w-full text-gray-4">
      <div class="flex gap-2">
        <img
          src="{import.meta.env.VITE_IPFS_GATEWAY}/{meme.image}"
          alt={meme.name}
          class="w-30 object-contain"
        />
        <div>
          <h2>{meme.name} <b>${meme.symbol}</b></h2>
          <div class="text-sm">{meme.description}</div>
        </div>
      </div>
    </div>

    <!-- Holder -->
    <div class="w-full">
      <TokenHolder {meme} />
    </div>
    <!-- End Right Nav -->
  </div>
</div>
