<script lang="ts">
  import { onMount } from "svelte";

  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";
  import { MCMemeSubscribe, memebids$ } from "$lib/store/memebids";

  let notification: {
    meme_id: number;
    party: string;
    ticker: string;
    icon: string;
    at: number;
  } | null = null;

  let shake = false;

  $: $memebids$.then((meme) => {
    const firstMeme = meme[0];
    console.log("[MemeCreationNotification] meme", firstMeme);
    notification = {
      meme_id: firstMeme.meme_id,
      party: firstMeme.owner,
      ticker: firstMeme.symbol,
      icon: `${import.meta.env.VITE_IPFS_GATEWAY}/${firstMeme.image}`,
      at: firstMeme.created_timestamp_ms,
    };
  });
  onMount(() => {
    console.log("[MemeCreationNotification] memebids$");

    const symbol = Symbol("notification");
    MCMemeSubscribe(symbol, (newMemeInfo) => {
      notification = {
        meme_id: newMemeInfo.meme_id,
        party: newMemeInfo.owner,
        ticker: newMemeInfo.symbol,
        icon: `${import.meta.env.VITE_IPFS_GATEWAY}/${newMemeInfo.image}`,
        at: newMemeInfo.created_timestamp_ms,
      };

      // Trigger the shake animation
      shake = true;
      setTimeout(() => {
        shake = false;
      }, 500); // Duration of the shake animation
    });
  });
</script>

{#if notification !== null}
  <section
    class="flex items-center bg-blue-400 text-sm text-dark px-2 py-1 rounded {shake
      ? 'animate-shake-x animate-duration-500'
      : ''}"
  >
    <img src={SHITZU_POCKET} alt="shitzu pocket" class="size-6 mr-1" />
    <a
      href={`/profile/${notification.party}`}
      class="max-w-20 overflow-hidden text-ellipsis mx-1 hover:font-bold whitespace-nowrap text-memecooking-9"
    >
      {notification.party}
    </a>
    created
    <a
      href={`/meme/${notification.meme_id}`}
      class="text-shitzu-7 flex items-center ml-1 hover:font-bold"
    >
      {notification.ticker}
      <img
        src={notification.icon}
        alt="icon"
        class="size-6 rounded-full mx-1"
      />
    </a>{" "}
    on {new Date(notification.at).toLocaleString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    })}
  </section>
{/if}
