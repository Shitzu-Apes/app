<script lang="ts">
  import { BottomSheetContent } from "$lib/layout/BottomSheet";
  import { closeBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
</script>

<BottomSheetContent variant="shitzu">
  <slot slot="header">
    <h2
      class="prose prose-invert prose-shitzu px-4 text-2xl font-bold text-shitzu-4"
    >
      How meme.cooking Works
    </h2>
  </slot>
  <section class="text-white px-3 space-y-4 my-10">
    <div class="space-y-6">
      <span class="inline-block">
        step 1: <strong class="text-shitzu-4">pick a token:</strong> choose a token
        you like
      </span>
      <span class="inline-block">
        step 2: <strong class="text-shitzu-4"
          >participate in the auction:</strong
        > buy the token during the auction period
      </span>
      <span class="inline-block">
        step 3: <strong class="text-shitzu-4">reach the goal:</strong> if at least
        100 NEAR have been deposited by the end of the auction, the token is created
      </span>
      <span class="inline-block">
        step 4: <strong class="text-shitzu-4">fair distribution:</strong> the token
        is distributed among buyers at a fair price
      </span>
      <span class="inline-block">
        step 5: <strong class="text-shitzu-4">liquidity provision:</strong> 50% of
        token supply and 100% of deposited NEAR will be used to provide liquidity
        on Ref Finance and burned
      </span>
      <span class="inline-block">
        step 6: <strong class="text-shitzu-4">refund if not successful:</strong>
        if the goal is not met, all participants get their money back
      </span>
    </div>
  </section>
  <button class="w-full text-white hover:font-bold" on:click={closeBottomSheet}>
    [I'm ready to cook]
  </button>
</BottomSheetContent>
