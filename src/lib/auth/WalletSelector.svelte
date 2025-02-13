<script lang="ts">
  import type { SignerWalletAdapter } from "@solana/wallet-adapter-base";
  import { connect, getConnectors, disconnect } from "@wagmi/core";

  import { config, evmWallet$, switchToChain } from "$lib/evm/wallet";
  import {
    closeBottomSheet,
    openBottomSheet,
  } from "$lib/layout/BottomSheet/Container.svelte";
  import Content from "$lib/layout/BottomSheet/Content.svelte";
  import type { UnionModuleState } from "$lib/models";
  import { NEAR_WALLETS, nearWallet } from "$lib/near";
  import { solanaWallet } from "$lib/solana/wallet";

  const { modules$, account$, iconUrl$, walletName$ } = nearWallet;
  const {
    publicKey$,
    selectedWallet$,
    connected$: solanaConnected$,
  } = solanaWallet;
  const solanaWallets$ = solanaWallet.wallets$;
  const connectors = getConnectors(config);

  // Add wallet state subscriptions
  $: nearConnected = $account$ != null;
  $: baseConnected = $evmWallet$.isConnected;

  export let initialNetwork: "near" | "solana" | "evm" | undefined = undefined;
  let selectedNetwork: "near" | "solana" | "evm" = initialNetwork ?? "near";

  function handleNetworkChange(network: "near" | "solana" | "evm") {
    if (document.startViewTransition) {
      document.startViewTransition(() => {
        selectedNetwork = network;
      });
    } else {
      selectedNetwork = network;
    }
  }

  async function handleNearWalletClick(unionMod: UnionModuleState) {
    await nearWallet.loginViaWalletSelector(unionMod);
    closeBottomSheet();
  }

  async function handleSolanaWalletClick(wallet: SignerWalletAdapter) {
    try {
      await solanaWallet.connect(wallet);
      closeBottomSheet();
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    }
  }

  async function handleBaseWalletClick(connector: (typeof connectors)[number]) {
    try {
      await connect(config, { connector });
      await switchToChain();
      closeBottomSheet();
    } catch (error) {
      console.error("Failed to connect Base wallet:", error);
    }
  }

  // Add disconnect handlers
  async function handleNearDisconnect() {
    await nearWallet.signOut();
    closeBottomSheet();
  }

  async function handleSolanaDisconnect() {
    await solanaWallet.disconnect();
    closeBottomSheet();
  }

  async function handleBaseDisconnect() {
    await disconnect(config);
    closeBottomSheet();
  }
</script>

<Content>
  <slot slot="header">
    <h1 class="ml-3 text-2xl text-white font-semibold">Select Wallet</h1>
  </slot>
  <slot>
    <div class="flex justify-center gap-2 mb-6">
      <button
        class="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 {selectedNetwork ===
        'near'
          ? 'bg-purple-900/40 text-purple-100'
          : 'hover:bg-purple-900/20 text-purple-200/70 hover:text-purple-100'}"
        on:click={() => handleNetworkChange("near")}
      >
        <img src="/near-logo.webp" alt="NEAR" class="w-5 h-5 rounded-full" />
        NEAR
      </button>
      <button
        class="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 {selectedNetwork ===
        'solana'
          ? 'bg-purple-900/40 text-purple-100'
          : 'hover:bg-purple-900/20 text-purple-200/70 hover:text-purple-100'}"
        on:click={() => handleNetworkChange("solana")}
      >
        <img src="/sol-logo.webp" alt="Solana" class="w-5 h-5 rounded-full" />
        Solana
      </button>
      <button
        class="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 {selectedNetwork ===
        'evm'
          ? 'bg-purple-900/40 text-purple-100'
          : 'hover:bg-purple-900/20 text-purple-200/70 hover:text-purple-100'}"
        on:click={() => handleNetworkChange("evm")}
      >
        <img src="/evm-logo.svg" alt="EVM" class="w-5 h-5 rounded-full" />
        EVM
      </button>
    </div>

    <div class="mx-auto flex flex-col gap-4 w-full max-w-xs mt-3 pb-6">
      <div class="wallet-list">
        {#if selectedNetwork === "near"}
          {#if nearConnected}
            {#await Promise.all( [$iconUrl$, $walletName$, $account$], ) then [iconUrl, walletName, account]}
              <div
                class="flex items-center gap-3 p-4 rounded-xl bg-purple-900/20 mb-4"
              >
                <img
                  src={iconUrl}
                  alt={walletName}
                  class="w-10 h-10 rounded-full {(walletName ?? '')
                    .replaceAll(' ', '-')
                    .toLowerCase()}"
                />
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-purple-100">
                    {walletName}
                  </div>
                  <div class="text-sm text-purple-200/70 truncate">
                    {account?.accountId}
                  </div>
                </div>
              </div>
              <button
                on:click={handleNearDisconnect}
                class="w-full hover:bg-purple-800/50 p-4 rounded-xl flex items-center justify-center gap-2 transition-colors text-white"
              >
                <div class="i-mdi:logout w-6 h-6" />
                Disconnect NEAR Wallet
              </button>
            {/await}
          {:else}
            {#await $modules$ then mods}
              {#each mods as mod (mod.id)}
                <div class="flex gap-2 items-center">
                  <button
                    disabled={!mod.metadata.available}
                    on:click={() => handleNearWalletClick(mod)}
                    class="hover:bg-purple-800/50 p-2 rounded-xl flex items-center flex-1 transition-colors"
                  >
                    <img
                      src={mod.metadata.iconUrl}
                      alt={mod.metadata.name}
                      class={`w-10 h-10 object-contain mr-5 ${mod.metadata.name.replaceAll(" ", "-").toLowerCase()}`}
                    />
                    <div class="flex flex-col text-left uppercase mr-auto">
                      <span class="text-white"
                        >{NEAR_WALLETS[mod.id].name ?? mod.metadata.name}</span
                      >
                      {#if NEAR_WALLETS[mod.id].url != null}
                        <span class="text-sm text-gray-400">
                          {new URL(NEAR_WALLETS[mod.id].url ?? "").hostname}
                        </span>
                      {/if}
                    </div>
                  </button>
                  {#if mod.type === "injected"}
                    {#if NEAR_WALLETS[mod.id].extensionUrl != null}
                      <a
                        href={NEAR_WALLETS[mod.id].extensionUrl}
                        target="_blank"
                        rel="noopener"
                        class="hover:bg-purple-800/50 p-2 rounded-xl transition-colors"
                        on:click|stopPropagation
                        aria-label="Download Wallet"
                      >
                        <div class="i-mdi:download w-8 h-8" />
                      </a>
                    {:else if mod.metadata.downloadUrl != null && mod.id !== "ethereum-wallets"}
                      <a
                        href={mod.metadata.downloadUrl}
                        target="_blank"
                        rel="noopener"
                        class="hover:bg-purple-800/50 p-2 rounded-xl transition-colors"
                        on:click|stopPropagation
                        aria-label="Download Wallet"
                      >
                        <div class="i-mdi:download w-8 h-8 text-white" />
                      </a>
                    {:else if NEAR_WALLETS[mod.id].infoSheet != null}
                      <button
                        class="hover:bg-purple-800/50 p-2 rounded-xl transition-colors"
                        on:click={() => {
                          openBottomSheet(NEAR_WALLETS[mod.id].infoSheet);
                        }}
                        aria-label="Learn More"
                      >
                        <div
                          class="i-mdi:information-outline w-8 h-8 text-white"
                        />
                      </button>
                    {/if}
                  {/if}
                </div>
              {/each}
            {/await}
          {/if}
        {:else if selectedNetwork === "solana"}
          {#if $solanaConnected$}
            {#await Promise.all( [$selectedWallet$, $publicKey$], ) then [selectedWallet, publicKey]}
              <div
                class="flex items-center gap-3 p-4 rounded-xl bg-purple-900/20 mb-4"
              >
                <img
                  src={selectedWallet?.icon}
                  alt={selectedWallet?.name}
                  class="w-10 h-10 rounded-full"
                />
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-purple-100">
                    {selectedWallet?.name}
                  </div>
                  <div class="text-sm text-purple-200/70 truncate">
                    {publicKey?.toBase58().slice(0, 4)}...{publicKey
                      ?.toBase58()
                      .slice(-4)}
                  </div>
                </div>
              </div>
              <button
                on:click={handleSolanaDisconnect}
                class="w-full hover:bg-purple-800/50 p-4 rounded-xl flex items-center justify-center gap-2 transition-colors text-white"
              >
                <div class="i-mdi:logout w-6 h-6" />
                Disconnect Solana Wallet
              </button>
            {/await}
          {:else}
            {#each $solanaWallets$ as wallet}
              <div class="flex gap-2 items-center">
                <button
                  on:click={() => handleSolanaWalletClick(wallet)}
                  class="hover:bg-purple-800/50 p-2 rounded-xl flex items-center flex-1 transition-colors"
                >
                  <img
                    src={wallet.icon}
                    alt={wallet.name}
                    class="w-10 h-10 object-contain mr-5"
                  />
                  <div class="flex flex-col text-left uppercase mr-auto">
                    <span class="text-white">{wallet.name}</span>
                  </div>
                </button>
                {#if wallet.url}
                  <a
                    href={wallet.url}
                    target="_blank"
                    rel="noopener"
                    class="hover:bg-purple-800/50 p-2 rounded-xl transition-colors"
                    on:click|stopPropagation
                    aria-label="Download Wallet"
                  >
                    <div class="i-mdi:download w-8 h-8 text-white" />
                  </a>
                {/if}
              </div>
            {/each}
          {/if}
        {:else}
          <!-- Base Wallet Section -->
          {#if baseConnected}
            <div
              class="flex items-center gap-3 p-4 rounded-xl bg-purple-900/20 mb-4"
            >
              <img
                src={$evmWallet$.connector?.icon}
                alt={$evmWallet$.connector?.name ?? "EVM Wallet"}
                class="w-10 h-10 rounded-full"
              />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-purple-100">
                  {$evmWallet$.connector?.name ?? "EVM Wallet"}
                </div>
                <div class="text-sm text-purple-200/70 truncate">
                  {$evmWallet$?.address?.slice(
                    0,
                    4,
                  )}...{$evmWallet$?.address?.slice(-4)}
                </div>
              </div>
            </div>
            <button
              on:click={handleBaseDisconnect}
              class="w-full hover:bg-purple-800/50 p-4 rounded-xl flex items-center justify-center gap-2 transition-colors text-white"
            >
              <div class="i-mdi:logout w-6 h-6" />
              Disconnect Base Wallet
            </button>
          {:else}
            <div class="flex flex-col gap-2">
              {#each connectors as connector (connector.id)}
                {#if connector.id !== "injected"}
                  <div class="flex gap-2 items-center">
                    <button
                      on:click={() => handleBaseWalletClick(connector)}
                      class="hover:bg-purple-800/50 p-2 rounded-xl flex items-center flex-1 transition-colors"
                    >
                      <img
                        src={connector.icon}
                        alt={connector.name}
                        class="w-10 h-10 object-contain mr-5"
                      />
                      <div class="flex flex-col text-left uppercase mr-auto">
                        <span class="text-white">{connector.name}</span>
                      </div>
                    </button>
                  </div>
                {/if}
              {/each}
              {#if connectors.length === 0}
                <div class="text-center text-purple-200/70 py-2">
                  No EVM wallets detected. Install MetaMask or another EVM
                  wallet to continue.
                </div>
                <a
                  href="https://metamask.io/download/"
                  target="_blank"
                  rel="noopener"
                  class="hover:bg-purple-800/50 p-2 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <div class="i-mdi:download w-6 h-6 text-white" />
                  <span>Install MetaMask</span>
                </a>
              {/if}
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </slot>
</Content>

<style>
  :global(.bitte-wallet) {
    background: #1a1a1a;
    border-radius: 0.25rem;
  }

  .wallet-list {
    view-transition-name: wallet-list;
  }

  ::view-transition-old(wallet-list) {
    animation: fade-out 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }

  ::view-transition-new(wallet-list) {
    animation: fade-in 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }

  @keyframes fade-out {
    0% {
      opacity: 1;
      transform: translateX(0);
    }
    100% {
      opacity: 0;
      transform: translateX(-32px);
    }
  }

  @keyframes fade-in {
    0% {
      opacity: 0;
      transform: translateX(32px);
    }
    100% {
      opacity: 1;
      transform: translateX(0);
    }
  }
</style>
