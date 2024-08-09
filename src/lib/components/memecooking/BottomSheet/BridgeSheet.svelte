<script lang="ts">
  import { BottomSheetContent } from "$lib/layout/BottomSheet";
</script>

<BottomSheetContent variant="shitzu">
  <slot slot="header">
    <h2 class="prose prose-invert prose-shitzu px-4 text-2xl">Bridge</h2>
  </slot>
  <section class="px-3 py-6 text-white">
    <div class="flex justify-between">
      <h3>Bridge</h3>
      <h3>From</h3>
    </div>
    <ul class="flex flex-col gap-3 my-6">
      <li class="flex justify-between border-b border-shitzu-4 pb-3">
        <a
          href="https://app.rocketx.exchange/swap/SOLANA.solana/NEAR.near/0.0061?from=Solana&to=NEAR%20Protocol&mode=w"
          target="_blank"
          rel="noopener noreferrer"
        >
          [Rocketx]
        </a>
        <h3>Solana</h3>
      </li>
      <li class="flex justify-between border-b border-shitzu-4 pb-3">
        <a
          href="https://tokenbridge.app/"
          target="_blank"
          rel="noopener noreferrer"
        >
          [Tokenbridge]
        </a>
        <h3>Solana</h3>
      </li>
      <li class="flex justify-between">
        <a
          href="https://rainbowbridge.app/"
          target="_blank"
          rel="noopener noreferrer"
        >
          [Rainbow Bridge]
        </a>
        <h3>Ethereum</h3>
      </li>
    </ul>
  </section>
</BottomSheetContent>
