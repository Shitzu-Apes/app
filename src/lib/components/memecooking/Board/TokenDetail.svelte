<script lang="ts">
  import Chef from "../Chef.svelte";

  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";
  import SHITZU_STONK from "$lib/assets/static/shitzu_stonk.png";
  import McIcon from "$lib/components/MCIcon.svelte";
  import { addToast } from "$lib/components/Toast.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { getTokenId } from "$lib/util/getTokenId";

  export let memebid: Meme;

  const { projectedPoolStats } = memebid;
</script>

<div class="flex flex-col w-full h-full">
  <!-- Token Basic Info -->
  <div class="flex items-start gap-4 py-4">
    <McIcon meme={memebid} class="size-16 bg-white object-contain" />
    <div class="flex-1">
      <h1 class="text-2xl font-medium">{memebid.name}</h1>
      <div class="flex items-center gap-2 text-gray-400 flex-wrap">
        <span class="font-medium text-shitzu-400">${memebid.symbol}</span>
        {#if memebid.pool_id}
          <div class="flex items-center gap-1">
            <span class="text-xs">CA:</span>
            <code class="text-xs bg-gray-800 px-2 py-1 rounded">
              {memebid.token_id}
            </code>
            <button
              class="p-1 hover:bg-gray-700 rounded"
              on:click={() => {
                navigator.clipboard.writeText(getTokenId(memebid));
                addToast({
                  data: {
                    type: "simple",
                    data: {
                      title: "Copied",
                      description: "Contract address copied!",
                      color: "green",
                    },
                  },
                });
              }}
            >
              <div class="i-mdi:content-copy text-lg" />
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
  <!-- Description & Image -->
  <div class="flex gap-2">
    <div class="w-full">
      <div class="flex h-full">
        <div class="w-full flex flex-col gap-4">
          <!-- Description -->
          <div class="flex gap-1 text-sm">
            <span class="w-6 flex justify-center flex-shrink-0">
              <div class="i-mdi:text size-5 text-memecooking-400" />
            </span>
            <span class="flex-1 text-gray-200">
              {memebid.description}
            </span>
          </div>

          <!-- Market Cap -->
          <div class="flex items-center gap-1">
            <span class="w-6 flex justify-center flex-shrink-0">
              <div class="i-mdi:chart-line text-memecooking-400" />
            </span>
            <span class="text-memecooking-400 text-sm font-medium">MC:</span>
            <span class="font-medium">
              {#if $projectedPoolStats}
                ${$projectedPoolStats.mcap.format({
                  maximumFractionDigits: 1,
                  notation: "compact",
                })}
              {:else}
                -
              {/if}
            </span>
          </div>

          <!-- Liquidity -->
          <div class="flex items-center gap-1">
            <span class="w-6 flex justify-center flex-shrink-0">
              <div class="i-mdi:water text-memecooking-400" />
            </span>
            <span class="text-memecooking-400 text-sm font-medium"
              >Liquidity:</span
            >
            <span class="font-medium">
              {#if $projectedPoolStats}
                ${$projectedPoolStats.liquidity.format({
                  maximumFractionDigits: 1,
                  notation: "compact",
                })}
              {:else}
                -
              {/if}
            </span>
          </div>

          <!-- Created By -->
          <div class="flex items-center gap-1">
            <span class="w-6 flex justify-center flex-shrink-0">
              <img src={SHITZU_POCKET} alt="Shitzu Pocket" class="size-6" />
            </span>
            <span
              class="text-memecooking-400 flex-shrink-0 text-sm font-medium"
            >
              By:
            </span>
            <Chef
              account={memebid.owner}
              asLink
              hideAvatar
              class="text-blue-400 underline text-sm hover:text-shitzu-4"
            />
          </div>

          <!-- Holders -->
          {#if memebid.token_id == null}
            <div class="flex items-center gap-1">
              <span class="w-6 flex justify-center flex-shrink-0">
                <img src={SHITZU_STONK} alt="Shitzu Stonk" class="size-6" />
              </span>
              <span class="text-memecooking-400 text-sm font-medium"
                >Holders:</span
              >
              <span class="font-medium">
                {#if memebid.staker_count}
                  {memebid.staker_count}
                {:else}
                  -
                {/if}
              </span>
            </div>
          {/if}

          {#if memebid.twitterLink && (memebid.twitterLink.startsWith("https://twitter.com/") || memebid.twitterLink.startsWith("https://x.com/"))}
            <div class="flex items-center gap-1">
              <span class="w-6 flex justify-center flex-shrink-0">
                <div class="i-mdi:twitter text-memecooking-400" />
              </span>
              <span class="text-memecooking-400 text-sm font-medium">𝕏:</span>
              <a
                href={memebid.twitterLink}
                class="text-blue-400 underline text-sm hover:text-shitzu-4 truncate"
                target="_blank"
                rel="noopener noreferrer"
              >
                {memebid.twitterLink.replace(
                  /https:\/\/(twitter|x)\.com\//,
                  "",
                )}
              </a>
            </div>
          {/if}

          {#if memebid.telegramLink && memebid.telegramLink.startsWith("https://t.me/")}
            <div class="flex items-center gap-1">
              <span class="w-6 flex justify-center flex-shrink-0">
                <div class="i-mdi:telegram text-memecooking-400" />
              </span>
              <span class="text-memecooking-400 text-sm font-medium">TG:</span>
              <a
                href={memebid.telegramLink}
                class="text-blue-400 underline text-sm hover:text-shitzu-4 truncate"
                target="_blank"
                rel="noopener noreferrer"
              >
                {memebid.telegramLink.replace("https://t.me/", "")}
              </a>
            </div>
          {/if}

          {#if memebid.website && memebid.website.startsWith("https://")}
            <div class="flex items-center gap-1">
              <span class="w-6 flex justify-center flex-shrink-0">
                <div class="i-mdi:web text-memecooking-400" />
              </span>
              <span class="text-memecooking-400 text-sm font-medium">Web:</span>
              <a
                href={memebid.website}
                class="text-blue-400 underline text-sm hover:text-shitzu-4 truncate"
                target="_blank"
                rel="noopener noreferrer"
              >
                {memebid.website.replace("https://", "")}
              </a>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>
