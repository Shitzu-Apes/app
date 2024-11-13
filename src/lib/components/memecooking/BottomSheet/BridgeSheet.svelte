<script lang="ts">
  import { writable } from "svelte/store";

  import ETHEREUM_ICON from "$lib/assets/logo/eth.svg";
  import RAINBOW_BRIDGE_LOGO from "$lib/assets/logo/rainbowbridge.webp";
  import REF_FINANCE_ICON from "$lib/assets/logo/ref.png";
  import ROCKETX_LOGO from "$lib/assets/logo/rocketx.jpeg";
  import SOLANA_ICON from "$lib/assets/logo/sol.svg";
  import STARGATE_ICON from "$lib/assets/logo/stargate.jpg";
  import TOKENBRIDGE_LOGO from "$lib/assets/logo/tokenbridge.jpg";
  import Stepper from "$lib/components/Stepper.svelte";
  import Tabs from "$lib/components/memecooking/Board/Tabs.svelte";
  import { BottomSheetContent } from "$lib/layout/BottomSheet";

  const selectedBlockchain = writable<"sol" | "eth" | "evm" | null>(null);
  const blockchains = [
    { id: "sol", label: "Solana", icon: SOLANA_ICON },
    { id: "eth", label: "Ethereum", icon: ETHEREUM_ICON },
    { id: "evm", label: "Other EVM" },
  ];
  const evm = [
    {
      id: "ref-finance",
      title: "Ref Finance",
      icon: REF_FINANCE_ICON,
      gasTopup: false,
      eta: "40s - 4min",
      etaColor: "bg-yellow-400",
      fees: "very low (bridge) & low (swap)",
      feesColor: "bg-green-400",
      steps: [
        {
          text: "Send USDC via",
          href: "https://app.ref.finance/bridge",
          linkText: "Ref Finance bridge aggregator",
        },
        {
          text: "Swap USDC to NEAR via",
          href: `${import.meta.env.VITE_REF_APP_URL}/#17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1|near`,
          linkText: "Ref Finance",
        },
      ],
    },
    {
      id: "evm-stargate-1",
      icon: STARGATE_ICON,
      title: "Stargate Finance v1",
      gasTopup: true,
      eta: "40s - 4min",
      etaColor: "bg-yellow-400",
      fees: "very low (bridge) & low (swap)",
      feesColor: "bg-green-400",
      steps: [
        {
          text: "Send USDC from EVM to Aurora via",
          href: "https://stargate.finance/bridge",
          linkText: "Stargate Finance",
        },
        {
          text: "Swap USDC to wNEAR via",
          href: "https://trisolaris.io/",
          linkText: "Trisolaris",
        },
        {
          text: "Send wNEAR from Aurora to Near via",
          href: "https://rainbowbridge.app/",
          linkText: "Rainbow Bridge",
        },
      ],
    },
    {
      id: "evm-stargate-2",
      icon: STARGATE_ICON,
      title: "Stargate Finance v2",
      gasTopup: false,
      eta: "40s - 4min",
      etaColor: "bg-yellow-400",
      fees: "very low (bridge) & low (swap)",
      feesColor: "bg-green-400",
      steps: [
        {
          text: "Send USDC from EVM to Aurora via",
          href: "https://stargate.finance/bridge",
          linkText: "Stargate Finance",
        },
        {
          text: "Send USDC from Aurora to Near via",
          href: "https://rainbowbridge.app/",
          linkText: "Rainbow Bridge",
        },
        {
          text: "Swap USDC to NEAR via",
          href: `${import.meta.env.VITE_REF_APP_URL}/#17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1|near`,
          linkText: "Ref Finance",
        },
      ],
    },
  ];

  const bridgeOptions = {
    sol: [
      {
        id: "solana-rocketx",
        icon: ROCKETX_LOGO,
        title: "RocketX",
        gasTopup: true,
        eta: "5min",
        etaColor: "bg-yellow-400",
        fees: "low (bridge & swap)",
        feesColor: "bg-green-400",
        steps: [
          {
            text: "Directly convert your SOL from Solana to NEAR on Near:",
            href: "https://app.rocketx.exchange/swap/SOLANA.solana/NEAR.near/0.0061?from=Solana&to=NEAR%20Protocol&mode=w",
            linkText: "Use RocketX",
          },
        ],
      },
      {
        id: "solana-tokenbridge",
        icon: TOKENBRIDGE_LOGO,
        title: "TokenBridge",
        gasTopup: false,
        eta: "15s",
        etaColor: "bg-green-400",
        fees: "very low (bridge) & low (swap)",
        feesColor: "bg-green-400",
        steps: [
          {
            text: "Convert SOL to SOL.w on Near via",
            href: "https://tokenbridge.app/",
            linkText: "TokenBridge",
          },
          {
            text: "Swap SOL.w to NEAR via",
            href: `${import.meta.env.VITE_REF_APP_URL}/#22.contract.portalbridge.near|near`,
            linkText: "Ref Finance",
          },
        ],
      },
    ],
    eth: [
      {
        id: "ethereum",
        icon: RAINBOW_BRIDGE_LOGO,
        title: "Rainbow Bridge",
        gasTopup: false,
        eta: "2min - 20min",
        etaColor: "bg-red-400",
        fees: "high (bridge) & low (swap)",
        feesColor: "bg-red-400",
        steps: [
          {
            text: "Send any ERC-20 or native ETH from Ethereum to Near via",
            href: "https://rainbowbridge.app/",
            linkText: "Rainbow Bridge",
          },
          {
            text: "Swap your tokens to NEAR via",
            href: `${import.meta.env.VITE_REF_APP_URL}/#|near`,
            linkText: "Ref Finance",
          },
        ],
      },
      ...evm,
    ],
    evm,
  };

  function handleTabChange(event: CustomEvent<string>) {
    selectedBlockchain.set(event.detail as "sol" | "eth" | "evm");
  }
</script>

<BottomSheetContent variant="shitzu">
  <slot slot="header">
    <h2 class="text-2xl font-bold text-white px-4 py-3">Bridge</h2>
  </slot>
  <section class="px-4 py-6 text-white">
    <h3 class="text-xl mb-4">GM, where are you coming from?</h3>
    <Tabs
      tabs={blockchains}
      activeTab={$selectedBlockchain}
      on:change={handleTabChange}
    />

    <div class="mt-6">
      {#if $selectedBlockchain !== null}
        {#each bridgeOptions[$selectedBlockchain] as { title, icon, gasTopup, eta, etaColor, fees, feesColor, steps }, index}
          <h2 class="text-lg font-medium mb-2">Option {index + 1}</h2>
          <div class="bg-gray-800 rounded-lg mb-4 p-4">
            <div class="flex items-center mb-2">
              {#if icon}
                <img src={icon} alt={title} class="w-6 h-6 mr-2" />
              {/if}
              <h2 class="text-lg font-medium">{title}</h2>
            </div>
            <div class="flex flex-wrap gap-3 mb-4">
              <span
                class="px-2 py-1 rounded-full text-xs font-medium {gasTopup
                  ? 'bg-green-400 text-gray-900'
                  : 'bg-red-400 text-white'}"
              >
                Gas Topup: {gasTopup ? "Yes" : "No"}
              </span>
              <span
                class="px-2 py-1 rounded-full text-xs font-medium {etaColor} text-gray-900"
              >
                ETA: ~{eta}
              </span>
              <span
                class="px-2 py-1 rounded-full text-xs font-medium {feesColor} text-gray-900"
              >
                Fees: {fees}
              </span>
            </div>
            <p class="mb-3">{steps.length}-step process:</p>
            <Stepper {steps} />
          </div>
        {/each}
      {/if}
    </div>
  </section>
</BottomSheetContent>
