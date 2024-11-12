<script lang="ts">
  import { addToast } from "../../Toast.svelte";

  import Near from "$lib/assets/Near.svelte";
  import SHITZU_CHEF from "$lib/assets/static/agt.png";
  import McIcon from "$lib/components/MCIcon.svelte";
  import { BottomSheetContent } from "$lib/layout/BottomSheet";
  import { closeBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { wallet } from "$lib/near";
  import type { FixedNumber } from "$lib/util";

  export let amount: FixedNumber;
  export let meme: Meme;

  const { accountId$ } = wallet;

  const twitterShareText = `I just deposited into the $${meme.symbol} token launch pool on @memedotcooking!\n\nGo check it out here:\n`;
  $: twitterShareUrl = `https://meme.cooking/meme/${meme.meme_id}?referral=${$accountId$ ?? ""}`;
  $: twitterShareLink = `https://x.com/intent/tweet?text=${encodeURI(twitterShareText)}&url=${encodeURI(twitterShareUrl)}`;

  let copying = false;

  async function copyReferralLink() {
    copying = true;
    const shareUrl = new URL(`${window.location.origin}/meme/${meme.meme_id}`);
    if ($accountId$) {
      shareUrl.searchParams.set("referral", $accountId$);
    }

    try {
      await navigator.clipboard.writeText(shareUrl.toString());
      addToast({
        data: {
          type: "simple",
          data: {
            title: "Success",
            description: "Referral link copied to clipboard!",
            color: "green",
          },
        },
      });
    } catch (error) {
      console.error("Error copying to clipboard:", error);
    }
    copying = false;
  }
</script>

<BottomSheetContent variant="shitzu">
  <slot slot="header">
    <h2
      class="prose prose-invert prose-shitzu px-4 text-2xl font-bold text-shitzu-4"
    >
      Deposit Successful!
    </h2>
  </slot>

  <section class="text-white px-4 space-y-6 my-6">
    <div class="flex items-center gap-4 bg-gray-800 p-4 rounded-lg">
      <McIcon {meme} class="w-16 h-16" />
      <div>
        <h3 class="text-xl">
          <span class="text-white">{meme.name}</span>
          <span class="text-shitzu-4">${meme.symbol}</span>
        </h3>
        <div class="flex items-center gap-2 mt-1">
          <Near className="w-5 h-5 bg-white text-black rounded-full" />
          <span class="font-medium">{amount.format()} NEAR</span>
        </div>
      </div>
    </div>

    <div class="bg-gray-800 rounded-lg p-4 space-y-3">
      <div class="flex items-center gap-2">
        <div class="size-10 rounded-full bg-gray-700 overflow-hidden">
          <img
            src={SHITZU_CHEF}
            class="w-full h-full object-cover rounded-full scale-110"
            alt="Shitzu Chef"
          />
        </div>
        <div>
          <div class="font-bold">You</div>
          <div class="text-gray-400">@you</div>
        </div>
      </div>

      <div class="text-sm whitespace-pre-line">
        {twitterShareText + twitterShareUrl}
      </div>

      <div class="text-gray-400 text-sm">
        {new Date().toLocaleTimeString()} · {new Date().toLocaleDateString()}
      </div>
    </div>

    <div class="flex gap-3">
      <a
        href={twitterShareLink}
        target="_blank"
        class="flex-1 text-lg text-center py-3 px-4 rounded bg-memecooking-400 hover:bg-memecooking-500 text-black transition-colors"
      >
        share on 𝕏
      </a>
      <button
        class="max-w-32 py-3 px-4 rounded border border-memecooking-400 hover:bg-memecooking-500 transition-colors text-memecooking-400 hover:text-black"
        on:click={copyReferralLink}
        disabled={copying}
      >
        {#if copying}
          <div class="i-svg-spinners-bars-scale animate-spin" />
        {:else}
          <div class="i-mdi-content-copy" />
        {/if}
      </button>
    </div>

    <div class="space-y-4">
      <span class="inline-block bg-gray-800 p-4 rounded-lg">
        <strong class="text-shitzu-4">Referral Rewards:</strong>
        Share your link and earn 50% of the protocol fee from your referrals.
      </span>

      <span class="inline-block bg-gray-800 p-4 rounded-lg">
        <strong class="text-shitzu-4">Example:</strong>
        When a user deposits through your referral link, the protocol fee is split
        - you earn 0.25% and the protocol earns 0.25%. For a 10N deposit, you would
        earn 0.025N.
      </span>
    </div>
  </section>

  <button
    class="w-full text-shitzu-4 hover:font-bold mb-20"
    on:click={closeBottomSheet}
  >
    [woof woof!]
  </button>
</BottomSheetContent>
