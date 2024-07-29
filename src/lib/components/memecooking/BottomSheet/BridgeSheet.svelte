<script lang="ts">
  import { BottomSheetContent } from "$lib/layout/BottomSheet";
</script>

<BottomSheetContent variant="shitzu">
  <slot slot="header">
    <h2 class="prose prose-invert prose-shitzu px-4 text-2xl">Bridge</h2>
  </slot>
  <section class="px-3 py-6 text-white">
    <h3 class="font-semibold text-lg">From Solana</h3>
    <ul class="my-3 flex gap-2">
      <li>
        <a
          href="https://app.rocketx.exchange/swap/SOLANA.solana/NEAR.near/0.0061?from=Solana&to=NEAR%20Protocol&mode=w"
          target="_blank"
          rel="noopener noreferrer"
        >
          [Rocketx]
        </a>
      </li>
      <li>
        <a
          href="https://tokenbridge.app/"
          target="_blank"
          rel="noopener noreferrer"
        >
          [Tokenbridge]
        </a>
      </li>
    </ul>
    <h3 class="font-semibold text-lg mt-6">From Ethereum</h3>
    <ul class="my-3 flex gap-2">
      <li>
        <a
          href="https://rainbowbridge.app/"
          target="_blank"
          rel="noopener noreferrer"
        >
          [Rainbow Bridge]
        </a>
      </li>
    </ul>
  </section>
</BottomSheetContent>
