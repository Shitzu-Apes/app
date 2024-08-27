<script lang="ts">
  import { BottomSheetContent } from "$lib/layout/BottomSheet";
</script>

<BottomSheetContent variant="shitzu">
  <slot slot="header">
    <h2 class="prose prose-invert prose-shitzu px-4 text-2xl">
      How Revenue Share Works
    </h2>
  </slot>
  <section class="prose prose-shitzu prose-invert p-6">
    Share your referral link with anyone. If they use your link you will receive
    50% of the protocol fee they generated.<br /><br />
    <strong>Example:</strong><br />
    A user uses your link to visit meme.cooking and deposits 10N into a meme coin
    launch. The regular protocol fee is 0.5% for deposits. Since the user used your
    link the protocol instead earns 0.25% (0.025N) and you earn 0.25% (0.025N).
  </section>
</BottomSheetContent>
