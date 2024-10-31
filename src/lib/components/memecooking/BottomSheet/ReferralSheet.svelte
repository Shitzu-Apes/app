<script lang="ts">
  import { addToast } from "../../Toast.svelte";

  import Near from "$lib/assets/Near.svelte";
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

    // if (navigator.share) {
    //   try {
    //     await navigator.share({
    //       title: document.title,
    //       url: shareUrl.toString(),
    //     });
    //   } catch (error) {
    //     console.error("Error sharing:", error);
    //   }
    // } else {
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
    // }
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
  <div class="flex flex-col items-center text-white px-4 py-6 space-y-6">
    <div class="flex items-center space-x-4">
      <McIcon {meme} class="w-16 h-16 rounded-full border-2 border-shitzu-4" />
      <div class="text-left">
        <h2 class="text-2xl font-bold text-shitzu-4">{meme.name}</h2>
        <p class="text-lg">Deposit Successful!</p>
      </div>
    </div>

    <div class="flex items-center space-x-2 text-2xl font-bold">
      <Near className="w-6 h-6 bg-white text-black rounded-full" />
      <span>{amount.format()} NEAR</span>
    </div>

    <div class="w-full flex space-x-4">
      <a
        href={twitterShareLink}
        target="_blank"
        class="flex-grow text-white border-1.5 border-white text-lg py-3 px-4 rounded hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors duration-200 text-center"
      >
        [share on 𝕏]
      </a>
      <button
        class="flex-none w-32 text-shitzu-4 text-lg py-3 px-4 rounded hover:font-bold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-shitzu-4 transition-colors duration-200"
        on:click={copyReferralLink}
        disabled={copying}
      >
        {copying ? "[copying...]" : "[copy link]"}
      </button>
    </div>

    <div class="w-full border border-shitzu-4 p-4 rounded-lg space-y-3">
      <h3 class="text-xl font-bold text-shitzu-4">Referral Rewards</h3>
      <p class="text-sm">
        Share your link and earn 50% of the protocol fee from your referrals.
      </p>
      <div class="bg-shitzu-7 p-3 rounded text-sm">
        <strong class="text-shitzu-4">Example:</strong> If a referral deposits 10N,
        you earn 0.025N (0.25%) and the protocol earns 0.025N (0.25%).
      </div>
    </div>

    <div class="w-full flex justify-between space-x-4">
      <button
        class="flex-1 text-shitzu-4 py-2 px-4 rounded-full hover:font-bold transition-colors duration-200"
        on:click={closeBottomSheet}
      >
        [got it, woof-woof!]
      </button>
    </div>
  </div>
</BottomSheetContent>
