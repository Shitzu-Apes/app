<script lang="ts">
  import { createAccordion, melt } from "@melt-ui/svelte";
  import { slide } from "svelte/transition";

  import { BottomSheetContent } from "$lib/layout/BottomSheet";

  const {
    elements: { content, item, trigger, root },
    helpers: { isSelected },
  } = createAccordion({
    defaultValue: "solana-rocketx",
  });

  const items = [
    {
      id: "solana-rocketx",
      title: "From Solana via RocketX",
      eta: "5min",
      etaColor: "bg-yellow-3",
      fees: "low (bridge & swap)",
      feesColor: "bg-shitzu-3",
    },
    {
      id: "solana-tokenbridge",
      title: "From Solana via TokenBridge",
      eta: "15s",
      etaColor: "bg-shitzu-3",
      fees: "very low (bridge) & medium (swap)",
      feesColor: "bg-yellow-3",
    },
    {
      id: "evm-stargate",
      title: "From EVM via Stargate Finance",
      eta: "40s - 4min",
      etaColor: "bg-shitzu-3",
      fees: "very low (bridge) & low (swap)",
      feesColor: "bg-shitzu-3",
    },
    {
      id: "ethereum",
      title: "From Ethereum via Rainbow Bridge",
      eta: "2min - 20min",
      etaColor: "bg-red-3",
      fees: "high (bridge) & low (swap)",
      feesColor: "bg-red-3",
    },
  ];
</script>

<BottomSheetContent variant="shitzu">
  <slot slot="header">
    <h2 class="prose prose-invert prose-shitzu px-4 text-2xl">Bridge</h2>
  </slot>
  <section class="px-3 py-6 text-white">
    <div class="mx-auto w-full rounded-xl bg-white shadow-lg" {...$root}>
      {#each items as { id, title, eta, etaColor, fees, feesColor }}
        <div
          use:melt={$item(id)}
          class="overflow-hidden transition-colors first:rounded-t-xl
              last:rounded-b-xl"
        >
          <h2 class="flex">
            <button
              use:melt={$trigger(id)}
              class="flex flex-1 cursor-pointer items-center justify-between bg-gray-700 px-5 py-5 text-base font-medium leading-none transition-colors hover:bg-gray-600 font-bold text-lg"
            >
              {title}
            </button>
          </h2>
          {#if $isSelected(id)}
            <div
              class="content overflow-hidden bg-gray-600 text-sm"
              use:melt={$content(id)}
              transition:slide
            >
              <div class="px-5 py-4">
                <div class="flex flex-wrap gap-4">
                  <span
                    class="text-xs self-end px-1 tracking-tight {etaColor} rounded-full text-black flex items-center gap-1"
                  >
                    ETA: ~{eta}
                  </span>
                  <span
                    class="text-xs self-end px-1 tracking-tight {feesColor} rounded-full text-black flex items-center gap-1"
                  >
                    Fees: {fees}
                  </span>
                </div>
                {#if id === "solana-rocketx"}
                  <ul class="flex flex-col gap-3 my-2">
                    <li
                      class="flex justify-between [&:not(:last-child)]:border-b border-shitzu-4"
                    >
                      <span>
                        Directly convert your SOL from Solana to NEAR on Near
                        via <a
                          class="text-lightblue-3"
                          href="https://app.rocketx.exchange/swap/SOLANA.solana/NEAR.near/0.0061?from=Solana&to=NEAR%20Protocol&mode=w"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          [RocketX]
                        </a>
                      </span>
                    </li>
                  </ul>
                {:else if id === "solana-tokenbridge"}
                  <ul class="flex flex-col gap-3 my-2">
                    <li
                      class="flex justify-between border-b border-shitzu-4 pb-2"
                    >
                      <span>
                        Convert your SOL on Solana to SOL.w (Wormhole wrapped
                        SOL) on Near via <a
                          class="text-lightblue-3"
                          href="https://tokenbridge.app/"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          [TokenBridge]
                        </a>
                      </span>
                    </li>
                    <li class="flex justify-between">
                      <span>
                        Swap SOL.w to NEAR via <a
                          class="text-lightblue-3"
                          href="https://app.ref.finance/#22.contract.portalbridge.near|near"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          [Ref Finance]
                        </a>
                      </span>
                    </li>
                  </ul>
                {:else if id === "evm-stargate"}
                  <ul class="flex flex-col gap-3 my-2">
                    <li
                      class="flex justify-between border-b border-shitzu-4 pb-2"
                    >
                      <span>
                        Send USDC from various LayerZero compatible EVMs to
                        Aurora via <a
                          class="text-lightblue-3"
                          href="https://stargate.finance/bridge"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          [Stargate Finance]
                        </a>
                      </span>
                    </li>
                    <li
                      class="flex justify-between border-b border-shitzu-4 pb-2"
                    >
                      <span>
                        Send USDC from Aurora to Near via <a
                          class="text-lightblue-3"
                          href="https://rainbowbridge.app/"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          [Rainbow Bridge]
                        </a>
                      </span>
                    </li>
                    <li class="flex justify-between">
                      <span>
                        Swap USDC to NEAR via <a
                          class="text-lightblue-3"
                          href="https://app.ref.finance/#17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1|near"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          [Ref Finance]
                        </a>
                      </span>
                    </li>
                  </ul>
                {:else if id === "ethereum"}
                  <ul class="flex flex-col gap-3 my-2">
                    <li
                      class="flex justify-between border-b border-shitzu-4 pb-2"
                    >
                      <span>
                        Send any ERC-20 or native ETH from Ethereum to Near via <a
                          class="text-lightblue-3"
                          href="https://rainbowbridge.app/"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          [Rainbow Bridge]
                        </a>
                      </span>
                    </li>
                    <li class="flex justify-between">
                      <span>
                        Swap your tokens to NEAR via <a
                          class="text-lightblue-3"
                          href="https://app.ref.finance/#|near"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          [Ref Finance]
                        </a>
                      </span>
                    </li>
                  </ul>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </section>
</BottomSheetContent>

<style>
  a {
    /* color: shi */
  }
</style>
