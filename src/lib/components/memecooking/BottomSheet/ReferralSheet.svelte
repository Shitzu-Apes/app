<script lang="ts">
  import { addToast } from "../Toast.svelte";

  import { BottomSheetContent } from "$lib/layout/BottomSheet";
  import { close } from "$lib/layout/BottomSheet/Container.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { wallet } from "$lib/near";
  import type { FixedNumber } from "$lib/util";

  export let amount: FixedNumber;
  export let meme: Meme;

  const { accountId$ } = wallet;

  const twitterShareText = `I just deposited into the $${meme.symbol} meme coin launch pool on @memedotcooking!\n\nGo check it out here:\n`;
  $: twitterShareUrl = `https://meme.cooking/meme/${meme.meme_id}?referral=${$accountId$ ?? ""}`;
  $: twitterShareLink = `https://twitter.com/intent/tweet?text=${encodeURI(twitterShareText)}&url=${encodeURI(twitterShareUrl)}`;
</script>

<BottomSheetContent variant="shitzu">
  <slot slot="header">
    <h2
      class="prose prose-invert prose-shitzu px-4 text-2xl font-bold text-shitzu-4"
    >
      Deposit Successful!
    </h2>
  </slot>
  <section class="text-white px-3 space-y-4 my-10">
    <div class="space-y-6 flex flex-col">
      <button
        class="text-white text-lg hover:underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white self-center"
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
                    description: "Referral link copied to clipboard!",
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
        [Copy Referral Link]
      </button>
      <a
        href={twitterShareLink}
        target="_blank"
        class="text-white text-lg hover:underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white self-center"
        >[Share on 𝕏]</a
      >

      <span class="inline-block">
        You successfully deposited {amount.format()} NEAR for {meme.name}
      </span>

      <span class="inline-block">
        <strong class="text-shitzu-4">Referral Fees:</strong> Share your referral
        link with anyone. If they use your link you will receive 50% of the protocol
        fee they generated.
      </span>
      <span class="inline-block">
        <strong class="text-shitzu-4">Example:</strong> A user uses your link to
        visit meme.cooking and deposits 10N into a meme coin launch. The regular
        protocol fee is 0.5% for deposits. Since the user used your link the protocol
        instead earns 0.25% (0.025N) and you earn 0.25% (0.025N).
      </span>
    </div>
  </section>
  <button class="w-full text-white hover:font-bold mb-20" on:click={close}>
    [close]
  </button>
</BottomSheetContent>
