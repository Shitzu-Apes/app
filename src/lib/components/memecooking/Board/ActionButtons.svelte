<script lang="ts">
  import type { Meme } from "$lib/api/client";
  import { flagMeme, unflagMeme, myFlags$ } from "$lib/auth/flag";
  import { isLoggedIn$ } from "$lib/auth/login";
  import { wallet } from "$lib/near";
  import { updateMemeFlagCount } from "$lib/store/memebids";
  import { shareWithReferral } from "$lib/util/referral";

  export let meme: Meme;

  const { accountId$ } = wallet;

  $: twitterShareText = `Check out $${meme.symbol} token launch pool on @memedotcooking:\n\n`;
  $: twitterShareUrl = `https://meme.cooking/meme/${meme.meme_id}?referral=${$accountId$ ?? ""}`;
  $: twitterShareLink = `https://x.com/intent/tweet?text=${encodeURI(twitterShareText)}&url=${encodeURI(twitterShareUrl)}`;

  $: isFlagged = $myFlags$.includes(meme.meme_id);

  async function toggleFlag() {
    if (!$isLoggedIn$) {
      await wallet.login();
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
  >
    <div class={`i-mdi:flag size-5 text-current`} />
    <span class="ml-1 text-sm">{meme.flag_count}</span>
  </button>
  <a
    href="https://t.me/bettearbot?start=ref-28757995"
    target="_blank"
    rel="noopener noreferrer"
    class="btn btn-outline hover:text-shitzu-200"
  >
    <div class="i-mdi:bell size-5 text-current" />
  </a>
  <button
    class="btn btn-outline hover:text-shitzu-200"
    on:click={() => shareWithReferral($accountId$, meme)}
  >
    <div class="i-mdi:share size-5 text-current" />
  </button>
  <a
    href={twitterShareLink}
    target="_blank"
    class="btn btn-outline hover:text-shitzu-200"
  >
    <div class="i-mdi:twitter size-5 text-current" />
  </a>
</div>
