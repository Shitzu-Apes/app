<script lang="ts">
  import { onMount } from "svelte";
  import { cubicOut } from "svelte/easing";

  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";
  import { MCMemeSubscribe } from "$lib/store/MCWebSocket";
  import { memebids$ } from "$lib/store/memebids";
  import { timesAgo } from "$lib/util/timesAgo";

  let notification: {
    meme_id: number;
    party: string;
    ticker: string;
    icon: string;
    at: number;
  } | null = null;

  function slideFromRight(node: Element, { delay = 0, duration = 400 } = {}) {
    return {
      delay,
      duration,
      easing: cubicOut,
      css: (t: number) => {
        const x = (1 - t) * 100;
        return `
          position: absolute;
          transform: translateX(${x}%);
          left: 0;
          top: 0;
          opacity: ${t};
        `;
      },
    };
  }

  $: {
    const memes = $memebids$;
    if (memes.length > 0) {
      const firstMeme = memes.sort(
        (a, b) =>
          Number(b.created_timestamp_ms) - Number(a.created_timestamp_ms),
      )[0];
      console.log("[MemeCreationNotification] meme", firstMeme);
      notification = {
        meme_id: firstMeme.meme_id,
        party: firstMeme.owner,
        ticker: firstMeme.symbol,
        icon: `${import.meta.env.VITE_IPFS_GATEWAY}/${firstMeme.image}`,
        at: Number(firstMeme.created_timestamp_ms),
      };
    }
  }
  onMount(() => {
    const symbol = Symbol("notification");
    MCMemeSubscribe(symbol, (newMemeInfo) => {
      notification = {
        meme_id: newMemeInfo.meme_id,
        party: newMemeInfo.owner,
        ticker: newMemeInfo.symbol,
        icon: `${import.meta.env.VITE_IPFS_GATEWAY}/${newMemeInfo.image}`,
        at: Number(newMemeInfo.created_timestamp_ms),
      };
    });
  });
</script>

<div class="w-full h-full relative">
  {#if notification !== null}
    {#key notification.meme_id}
      <!-- Meme Creation Notification -->
      <a
        href={`/meme/${notification.meme_id}`}
        class="flex w-40 h-20 rounded hover:ring-2 bg-blue-400/50 hover:ring-blue-300 overflow-hidden"
        in:slideFromRight={{ delay: 300, duration: 400 }}
        out:slideFromRight={{ duration: 400 }}
      >
        <div class="flex h-full w-full">
          <!-- Image Section -->
          <div class="relative w-1/3 h-full bg-white overflow-hidden">
            <img
              src={notification.icon}
              alt={notification.ticker}
              class="w-full h-full object-cover"
            />
          </div>

          <div class="w-2/3 p-2 flex flex-col justify-between">
            <!-- Date -->
            <div class="flex items-center gap-1 text-xs">
              <span class="w-4 flex justify-center flex-shrink-0">
                <div class="i-mdi:clock size-3" />
              </span>
              <span class="flex-shrink-1 font-medium truncate">
                {timesAgo(new Date(notification.at))}
              </span>
            </div>

            <!-- Ticker -->
            <div class="flex items-center gap-1 text-xs">
              <span class="w-4 flex justify-center flex-shrink-0">$</span>
              <span class="flex-shrink-1 font-medium text-shitzu-4 truncate">
                {notification.ticker}
              </span>
            </div>

            <!-- Creator -->
            <div class="flex items-center gap-1 text-xs">
              <span class="w-4 flex justify-center flex-shrink-0">
                <img src={SHITZU_POCKET} alt="U" class="size-3" />
              </span>
              <span class="flex-shrink-1 font-medium truncate">
                {notification.party}
              </span>
            </div>
          </div>
        </div>
      </a>
    {/key}
  {/if}
</div>
