<script lang="ts">
  import type { HereCall } from "@here-wallet/core";

  import { addToast } from "../../Toast.svelte";

  import { BottomSheetContent } from "$lib/layout/BottomSheet";
  import { closeBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import { wallet } from "$lib/near";

  export let accountId: string;
  export let transactions: HereCall[];

  function sendRegister() {
    closeBottomSheet();
    wallet.signAndSendTransactions(
      { transactions },
      {
        onSuccess: () => {
          addToast({
            data: {
              type: "simple",
              data: {
                title: "Registration Success",
                description: `Successfully registered your account ${accountId}`,
              },
            },
          });
        },
      },
    );
  }
</script>

<BottomSheetContent variant="shitzu">
  <slot slot="header">
    <h2
      class="prose prose-invert prose-shitzu px-4 text-2xl font-bold text-shitzu-4"
    >
      Register your EVM account
    </h2>
  </slot>
  <section class="text-white px-3 space-y-4 my-10">
    <div class="space-y-6">
      <span class="inline-block">
        gm, looks like it is your first time on meme.cooking using your EVM
        wallet.
      </span>

      <span class="inline-block">
        To create an address on Near Protocol, you first need to sign a
        transaction, which will onboard your account and enable you to transact
        on NEAR Protocol.
      </span>

      <span class="inline-block"
        >Since your wallet is new, you also won't have any NEAR to cover for gas
        fees. Your Near address that is controlled by your EVM wallet will use
        NEAR instead of ETH to cover for gas fees. The first onboarding
        transaction is free, but any other transactions requires gas.</span
      >

      <span class="inline-block"
        >Once you click "start registration" you will get prompted for the
        onboarding transaction. Please sign it. Afterwards you need to top up
        your account with gas. Once that is done, you can register your account
        in the meme.cooking smart contract and also in the wNEAR smart contract.</span
      >

      <span class="inline-block break-all"
        >Your address is (all lowercase):<br />{accountId}</span
      >

      <span class="inline-block"
        >Here are the instructions to top up your account:</span
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
    class="w-full text-white hover:font-bold mb-1"
    on:click={sendRegister}
  >
    [start registration]
  </button>
  <button
    class="w-full text-white hover:font-bold pb-8"
    on:click={closeBottomSheet}
  >
    [skip]
  </button>
</BottomSheetContent>
