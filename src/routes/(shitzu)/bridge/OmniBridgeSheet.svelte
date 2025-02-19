<script lang="ts">
  import { showWalletSelector } from "$lib/auth";
  import { BottomSheetContent } from "$lib/layout/BottomSheet";
</script>

<BottomSheetContent variant="shitzu">
  <slot slot="header">
    <h2
      class="prose prose-invert prose-shitzu px-4 text-2xl font-bold text-shitzu-4"
    >
      Welcome to OmniBridge
    </h2>
  </slot>
  <section class="text-white px-3 space-y-4 my-10">
    <div class="space-y-6">
      <span class="inline-block">
        OmniBridge is NEAR's powerful new way to move your assets between
        different blockchains easily and safely. Whether you want to bring
        tokens from Ethereum, Solana, Bitcoin, or other chains to NEAR (or the
        other way around), OmniBridge makes it simple.
      </span>

      <span class="inline-block">
        What makes OmniBridge special is that it works with any blockchain and
        keeps your assets secure using advanced security technology that's been
        battle-tested since 2021.
      </span>

      <div class="bg-gray-600 border-rd-sm p-2">
        <ul class="flex flex-col gap-3 my-2">
          <li class="flex justify-between border-b border-shitzu-4 pb-2">
            <span>
              🔒 <strong>Safe & Secure:</strong> Built on technology that has never
              been compromised
            </span>
          </li>
          <li class="flex justify-between border-b border-shitzu-4 pb-2">
            <span>
              ⚡ <strong>Fast & Efficient:</strong> Quick transfers with lower fees
              than traditional bridges
            </span>
          </li>
          <li class="flex justify-between border-b border-shitzu-4 pb-2">
            <span>
              🌐 <strong>Universal:</strong> Works with major blockchains like Ethereum,
              Solana, Bitcoin, and more
            </span>
          </li>
          <li class="flex justify-between">
            <span>
              💼 <strong>Simple to Use:</strong> Your NEAR account automatically
              works with other blockchains - no complex setup needed
            </span>
          </li>
        </ul>
      </div>

      <div class="text-center mt-4">
        <a
          href="https://near.org/blog/omnibridge-nears-universal-solution-for-cross-chain-liquidity"
          target="_blank"
          rel="noopener noreferrer"
          class="text-lime/70 hover:text-lime hover:underline transition-colors"
        >
          Read the full announcement →
        </a>
      </div>
    </div>
  </section>
  <button
    class="w-full text-white hover:font-bold mb-8"
    on:click={() => {
      showWalletSelector("shitzu");
    }}
  >
    [Connect wallet to get started]
  </button>
</BottomSheetContent>
