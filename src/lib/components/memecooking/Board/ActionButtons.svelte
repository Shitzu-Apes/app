<script lang="ts">
  import type { Meme } from "$lib/api/client";
  import { flagMeme, unflagMeme, myFlags$ } from "$lib/auth/flag";
  import { fetchIsLoggedIn, isLoggedIn$ } from "$lib/auth/login";
  import { addToast } from "$lib/components/Toast.svelte";
  import { nearWallet } from "$lib/near";
  import { updateMemeFlagCount } from "$lib/store/memebids";
  import { shareWithReferral } from "$lib/util/referral";

  export let meme: Meme;

  const { accountId$ } = nearWallet;

  $: twitterShareText = `Check out $${meme.symbol} token launch pool on @memedotcooking:\n\n`;
  $: twitterShareUrl = `https://meme.cooking/meme/${meme.meme_id}?referral=${$accountId$ ?? ""}`;
  $: twitterShareLink = `https://x.com/intent/tweet?text=${encodeURI(twitterShareText)}&url=${encodeURI(twitterShareUrl)}`;

  $: isFlagged = $myFlags$.includes(meme.meme_id);

  $: fetchIsLoggedIn();

  async function toggleFlag() {
    const isLoggedIn = await $isLoggedIn$;
    if (!isLoggedIn) {
      addToast({
        data: {
          type: "simple",
          data: {
            title: "Failed to flag meme",
            description: "Please login to flag memes",
            color: "red",
          },
        },
      });
      return nearWallet.login();
    }
    if (isFlagged) {
      unflagMeme(meme.meme_id);
      updateMemeFlagCount(meme.meme_id, (count) => count - 1);
    } else {
      flagMeme(meme.meme_id);
      updateMemeFlagCount(meme.meme_id, (count) => count + 1);
    }
  }
</script>

<div class="flex items-center justify-end gap-4">
  <button
    class="btn btn-outline hover:text-red-500 flex items-center {isFlagged
      ? 'text-red-500'
      : ''} "
    on:click={toggleFlag}
    aria-label="Flag meme"
  >
    <div class={`i-mdi:flag size-5 text-current`}></div>
    <span class="ml-1 text-sm">{meme.flag_count ?? 0}</span>
  </button>
  <button
    class="btn btn-outline hover:text-shitzu-200"
    on:click={() => shareWithReferral($accountId$, meme)}
    aria-label="Share meme"
  >
    <div class="i-mdi:share size-5 text-current"></div>
  </button>
  <a
    href={twitterShareLink}
    target="_blank"
    class="btn btn-outline hover:text-shitzu-200"
    aria-label="Share meme on Twitter"
  >
    <div class="i-mdi:twitter size-5 text-current"></div>
  </a>
</div>
