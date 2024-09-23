<script lang="ts">
  import WalletSelector from "$lib/auth/WalletSelector.svelte";
  import { BottomSheetContent } from "$lib/layout/BottomSheet";
  import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
</script>

<BottomSheetContent variant="shitzu">
  <slot slot="header">
    <h2
      class="prose prose-invert prose-shitzu px-4 text-2xl font-bold text-shitzu-4"
    >
      How to use an EVM wallet
    </h2>
  </slot>
  <section class="text-white px-3 space-y-4 my-10">
    <div class="space-y-6">
      <span class="inline-block">
        One of the most recent additions to Near Protocol is the native support
        of EVM wallets. This means you can use any EVM wallet as if it is a
        native Near wallet. The first time you use an EVM wallet you will have
        to sign a transaction to create your Near account, which will have the
        same address as your EVM wallet (but it's all lowercase and it's case
        sensitive, so be aware of that).
      </span>

      <span class="inline-block"
        >Since you are onboarding to Near and your wallet is new, you won't have
        any NEAR to cover for gas fees. Your Near address that is controlled by
        your EVM wallet will use NEAR instead of ETH to cover for gas fees. Here
        are the instructions to top up your account:</span
      >

      <div class="bg-gray-600 border-rd-sm p-2">
        <ul class="flex flex-col gap-3 my-2">
          <li class="flex justify-between border-b border-shitzu-4 pb-2">
            <span>
              Send USDC from various LayerZero compatible EVMs to Aurora via <a
                class="text-lightblue-3 hover:underline hover:font-bold"
                href="https://stargate.finance/bridge"
                target="_blank"
                rel="noopener noreferrer"
              >
                [Stargate Finance]
              </a>. It will automatically top up a short amount of ETH for gas
              on Aurora.
            </span>
          </li>
          <li class="flex justify-between border-b border-shitzu-4 pb-2">
            <span>
              Swap USDC to wNEAR via <a
                class="text-lightblue-3 hover:underline hover:font-bold"
                href="https://trisolaris.io/"
                target="_blank"
                rel="noopener noreferrer"
              >
                [Trisolaris]
              </a>
            </span>
          </li>
          <li class="flex justify-between">
            <span>
              Send wNEAR from Aurora to Near via <a
                class="text-lightblue-3 hover:underline hover:font-bold"
                href="https://rainbowbridge.app/"
                target="_blank"
                rel="noopener noreferrer"
              >
                [Rainbow Bridge]
              </a>
            </span>
          </li>
        </ul>
      </div>
    </div>
  </section>
  <button
    class="w-full text-white hover:font-bold"
    on:click={() => {
      openBottomSheet(WalletSelector);
    }}
  >
    [Sir wtf, this is only possible on Near]
  </button>
</BottomSheetContent>
