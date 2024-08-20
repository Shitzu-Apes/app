<script lang="ts">
  import { BottomSheetContent } from "$lib/layout/BottomSheet";
</script>

<BottomSheetContent variant="shitzu">
  <slot slot="header">
    <h2 class="prose prose-invert prose-shitzu px-4 text-2xl">
      How meme.cooking Works
    </h2>
  </slot>
  <section class="prose prose-shitzu prose-invert px-3">
    <ol>
      <li>
        <strong>Pick a Coin:</strong> Choose a virtual coin you like from the available
        options.
      </li>
      <li>
        <strong>Participate in the Auction:</strong> Buy the virtual coin during
        the auction period.
      </li>
      <li>
        <strong>Reach the Goal:</strong> If at least 4k NEAR have been deposited
        by the end of the auction, the coin is created.
      </li>
      <li>
        <strong>Fair Distribution:</strong> The coin is distributed among buyers
        at a fair price.
      </li>
      <li>
        <strong>Liquidity Provision:</strong> A portion of the liquidity is deposited
        and burned, ensuring stability.
      </li>
      <li>
        <strong>Refund if Not Successful:</strong> If the goal is not met, all participants
        get their money back.
      </li>
    </ol>
  </section>
</BottomSheetContent>
