<script lang="ts">
  import { slide } from "svelte/transition";

  import { balances$ } from "./tokens";

  import { showWalletSelector } from "$lib/auth";
  import Button from "$lib/components/Button.svelte";
  import { evmWallet$, disconnect as disconnectEvm } from "$lib/evm/wallet";
  import type { Token } from "$lib/models/tokens";
  import { nearWallet } from "$lib/near";
  import { solanaWallet } from "$lib/solana/wallet";

  export let token: keyof typeof balances$;
  export let tokenData: Token;

  let isExpanded = false;

  $: balance$ = balances$[token];

  const { accountId$, iconUrl$, walletName$, isLoading$ } = nearWallet;
  const { publicKey$, selectedWallet$, connected$ } = solanaWallet;

  function handleSignOut() {
    nearWallet.signOut();
  }

  function handleSolanaDisconnect() {
    solanaWallet.disconnect();
  }

  function handleEvmDisconnect() {
    disconnectEvm();
  }

  $: hasNearWallet = Boolean($accountId$);
  $: hasSolanaWallet = Boolean($connected$ && $selectedWallet$);
  $: hasEvmWallet = $evmWallet$.status === "connected";
  $: connectedWallets = [
    hasNearWallet && "NEAR",
    hasSolanaWallet && "Solana",
    hasEvmWallet && "EVM",
  ].filter(Boolean);
</script>

<div
  class="w-full mt-2 bg-black rounded-xl border border-lime/20 shadow-lg overflow-hidden"
>
  <button
    class="w-full flex items-center justify-between p-4 hover:bg-lime/5 transition-colors"
    on:click={() => (isExpanded = !isExpanded)}
  >
    <div class="flex items-center gap-3">
      <div class="flex -space-x-2">
        {#if hasNearWallet}
          {#await $iconUrl$ then iconUrl}
            <img
              src={iconUrl}
              alt="NEAR"
              class="w-6 h-6 rounded-full border-2 border-black"
            />
          {/await}
        {/if}
        {#if hasSolanaWallet && $selectedWallet$}
          <img
            src={$selectedWallet$.icon}
            alt="Solana"
            class="w-6 h-6 rounded-full border-2 border-black"
          />
        {/if}
        {#if hasEvmWallet}
          <img
            src={$evmWallet$.connector?.icon}
            alt="EVM"
            class="w-6 h-6 rounded-full border-2 border-black"
          />
        {/if}
        {#if !connectedWallets.length}
          <div
            class="w-6 h-6 rounded-full bg-lime/20 border-2 border-black flex items-center justify-center"
          >
            <div class="i-mdi:wallet-outline text-lime/70" />
          </div>
        {/if}
      </div>
      <div class="flex flex-col gap-0.5">
        <div class="text-sm">
          {#if connectedWallets.length}
            <span class="text-lime">{connectedWallets.join(" + ")}</span>
          {:else}
            <span class="text-lime/70">No wallets connected</span>
          {/if}
        </div>
        {#if connectedWallets.length}
          <div class="flex flex-wrap gap-2 text-xs text-lime/70">
            {#if hasNearWallet && $balance$.near}
              <div class="flex items-center gap-1">
                <img
                  src="/near-logo.webp"
                  alt="NEAR"
                  class="w-3 h-3 rounded-full"
                />
                <img
                  src={tokenData.icon}
                  alt={tokenData.symbol}
                  class="w-3 h-3 rounded-full"
                />
                <span class="font-medium text-lime"
                  >{$balance$.near.format({
                    compactDisplay: "short",
                    notation: "compact",
                    maximumFractionDigits: 2,
                  })}</span
                >
                <span>{tokenData.symbol}</span>
              </div>
            {/if}
            {#if hasSolanaWallet && $balance$.solana}
              <div class="flex items-center gap-1">
                <img
                  src="/sol-logo.webp"
                  alt="Solana"
                  class="w-3 h-3 rounded-full"
                />
                <img
                  src={tokenData.icon}
                  alt={tokenData.symbol}
                  class="w-3 h-3 rounded-full"
                />
                <span class="font-medium text-lime"
                  >{$balance$.solana.format({
                    compactDisplay: "short",
                    notation: "compact",
                    maximumFractionDigits: 2,
                  })}</span
                >
                <span>{tokenData.symbol}</span>
              </div>
            {/if}
            {#if hasEvmWallet}
              {#if $balance$.base}
                <div class="flex items-center gap-1">
                  <img
                    src="/base-logo.webp"
                    alt="Base"
                    class="w-3 h-3 rounded-full"
                  />
                  <img
                    src={tokenData.icon}
                    alt={tokenData.symbol}
                    class="w-3 h-3 rounded-full"
                  />
                  <span class="font-medium text-lime"
                    >{$balance$.base.format({
                      compactDisplay: "short",
                      notation: "compact",
                      maximumFractionDigits: 2,
                    })}</span
                  >
                  <span>{tokenData.symbol}</span>
                </div>
              {/if}
              {#if $balance$.arbitrum}
                <div class="flex items-center gap-1">
                  <img
                    src="/arb-logo.webp"
                    alt="Arbitrum"
                    class="w-3 h-3 rounded-full"
                  />
                  <img
                    src={tokenData.icon}
                    alt={tokenData.symbol}
                    class="w-3 h-3 rounded-full"
                  />
                  <span class="font-medium text-lime"
                    >{$balance$.arbitrum.format({
                      compactDisplay: "short",
                      notation: "compact",
                      maximumFractionDigits: 2,
                    })}</span
                  >
                  <span>{tokenData.symbol}</span>
                </div>
              {/if}
              {#if $balance$.ethereum}
                <div class="flex items-center gap-1">
                  <img
                    src="/evm-logo.svg"
                    alt="Ethereum"
                    class="w-3 h-3 rounded-full"
                  />
                  <img
                    src={tokenData.icon}
                    alt={tokenData.symbol}
                    class="w-3 h-3 rounded-full"
                  />
                  <span class="font-medium text-lime"
                    >{$balance$.ethereum.format({
                      compactDisplay: "short",
                      notation: "compact",
                      maximumFractionDigits: 2,
                    })}</span
                  >
                  <span>{tokenData.symbol}</span>
                </div>
              {/if}
            {/if}
          </div>
        {/if}
      </div>
    </div>
    <div
      class="i-mdi:chevron-down text-xl text-lime/70 transition-transform"
      class:rotate-180={isExpanded}
    />
  </button>

  {#if isExpanded}
    <div transition:slide|local={{ duration: 200 }}>
      <!-- NEAR Wallet Section -->
      <div class="px-4 py-2 border-t border-lime/20">
        {#if $accountId$}
          {#await Promise.all( [$iconUrl$, $walletName$, $accountId$], ) then [iconUrl, walletName, accountId]}
            <div class="flex items-center gap-3">
              <img
                src={iconUrl}
                alt={walletName}
                class="w-10 h-10 rounded-full {(walletName ?? '')
                  .replaceAll(' ', '-')
                  .toLowerCase()}"
              />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-lime">
                  {walletName}
                </div>
                <div class="text-sm text-lime/70 truncate">
                  {accountId}
                </div>
                {#if $balance$.near}
                  <div
                    class="flex items-center gap-2 text-sm text-lime/70 mt-1"
                  >
                    <img
                      src="/near-logo.webp"
                      alt="Near"
                      class="w-4 h-4 rounded-full"
                    />
                    <img
                      src={tokenData.icon}
                      alt={tokenData.symbol}
                      class="w-4 h-4 rounded-full"
                    />
                    <span class="font-medium text-lime"
                      >{$balance$.near?.format({
                        compactDisplay: "short",
                        notation: "compact",
                        maximumFractionDigits: 2,
                      })}</span
                    >
                    <span>{tokenData.symbol}</span>
                  </div>
                {/if}
              </div>
            </div>
            <Button
              type="secondary"
              onClick={handleSignOut}
              class="w-full !justify-start !px-4 mt-2"
            >
              <div class="i-mdi:logout text-xl" />
              <span class="ml-2">Disconnect NEAR</span>
            </Button>
          {/await}
        {:else}
          <Button
            type="secondary"
            onClick={(e) => {
              e.preventDefault();
              showWalletSelector(undefined, "near");
            }}
            loading={$isLoading$}
            class="w-full"
          >
            <img
              src="/near-logo.webp"
              alt="NEAR"
              class="w-5 h-5 rounded-full"
            />
            <span class="ml-2">Connect NEAR Wallet</span>
          </Button>
        {/if}
      </div>

      <!-- Solana Wallet Section -->
      <div class="px-4 py-2 border-t border-lime/20">
        {#if $connected$ && $selectedWallet$}
          <div class="flex items-center gap-3">
            <img
              src={$selectedWallet$.icon}
              alt={$selectedWallet$.name}
              class="w-10 h-10 rounded-full"
            />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-lime">
                {$selectedWallet$.name}
              </div>
              <div class="text-sm text-lime/70 truncate">
                {$publicKey$?.toBase58().slice(0, 4)}...{$publicKey$
                  ?.toBase58()
                  .slice(-4)}
              </div>
              {#if $balance$.solana}
                <div class="flex items-center gap-2 text-sm text-lime/70 mt-1">
                  <img
                    src="/sol-logo.webp"
                    alt="Solana"
                    class="w-4 h-4 rounded-full"
                  />
                  <img
                    src={tokenData.icon}
                    alt={tokenData.symbol}
                    class="w-4 h-4 rounded-full"
                  />
                  <span class="font-medium text-lime"
                    >{$balance$.solana.format({
                      compactDisplay: "short",
                      notation: "compact",
                      maximumFractionDigits: 2,
                    })}</span
                  >
                  <span>{tokenData.symbol}</span>
                </div>
              {/if}
            </div>
          </div>
          <Button
            type="secondary"
            onClick={handleSolanaDisconnect}
            class="w-full !justify-start !px-4 mt-2"
          >
            <div class="i-mdi:logout text-xl" />
            <span class="ml-2">Disconnect Solana</span>
          </Button>
        {:else}
          <Button
            type="secondary"
            onClick={(e) => {
              e.preventDefault();
              showWalletSelector(undefined, "solana");
            }}
            class="w-full"
          >
            <img
              src="/sol-logo.webp"
              alt="Solana"
              class="w-5 h-5 rounded-full"
            />
            <span class="ml-2">Connect Solana Wallet</span>
          </Button>
        {/if}
      </div>

      <!-- EVM Wallet Section -->
      <div class="px-4 py-2 border-t border-lime/20">
        {#if $evmWallet$.status === "connected"}
          <div class="flex items-center gap-3">
            <img
              src={$evmWallet$.connector?.icon}
              alt={$evmWallet$.connector?.name ?? "EVM Wallet"}
              class="w-10 h-10 rounded-full"
            />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-lime">
                {$evmWallet$.connector?.name ?? "EVM Wallet"}
              </div>
              <div class="text-sm text-lime/70 truncate">
                {$evmWallet$.address.slice(0, 4)}...{$evmWallet$.address.slice(
                  -4,
                )}
              </div>
              {#if $balance$.base}
                <div class="flex items-center gap-2 text-sm text-lime/70 mt-1">
                  <img
                    src="/base-logo.webp"
                    alt="Base"
                    class="w-4 h-4 rounded-full"
                  />
                  <img
                    src={tokenData.icon}
                    alt={tokenData.symbol}
                    class="w-4 h-4 rounded-full"
                  />
                  <span class="font-medium text-lime"
                    >{$balance$.base.format({
                      compactDisplay: "short",
                      notation: "compact",
                      maximumFractionDigits: 2,
                    })}</span
                  >
                  <span>{tokenData.symbol}</span>
                </div>
              {/if}
              {#if $balance$.arbitrum}
                <div class="flex items-center gap-2 text-sm text-lime/70 mt-1">
                  <img
                    src="/arb-logo.webp"
                    alt="Arbitrum"
                    class="w-4 h-4 rounded-full"
                  />
                  <img
                    src={tokenData.icon}
                    alt={tokenData.symbol}
                    class="w-4 h-4 rounded-full"
                  />
                  <span class="font-medium text-lime"
                    >{$balance$.arbitrum.format({
                      compactDisplay: "short",
                      notation: "compact",
                      maximumFractionDigits: 2,
                    })}</span
                  >
                  <span>{tokenData.symbol}</span>
                </div>
              {/if}
              {#if $balance$.ethereum}
                <div class="flex items-center gap-2 text-sm text-lime/70 mt-1">
                  <img
                    src="/evm-logo.svg"
                    alt="Ethereum"
                    class="w-4 h-4 rounded-full"
                  />
                  <img
                    src={tokenData.icon}
                    alt={tokenData.symbol}
                    class="w-4 h-4 rounded-full"
                  />
                  <span class="font-medium text-lime"
                    >{$balance$.ethereum?.format({
                      compactDisplay: "short",
                      notation: "compact",
                      maximumFractionDigits: 2,
                    })}</span
                  >
                  <span>{tokenData.symbol}</span>
                </div>
              {/if}
            </div>
          </div>
          <Button
            type="secondary"
            onClick={handleEvmDisconnect}
            class="w-full !justify-start !px-4 mt-2"
          >
            <div class="i-mdi:logout text-xl" />
            <span class="ml-2">Disconnect EVM</span>
          </Button>
        {:else}
          <Button
            type="secondary"
            onClick={(e) => {
              e.preventDefault();
              showWalletSelector(undefined, "ethereum");
            }}
            class="w-full"
          >
            <img src="/evm-logo.svg" alt="EVM" class="w-5 h-5 rounded-full" />
            <span class="ml-2">Connect EVM Wallet</span>
          </Button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  :global(.bitte-wallet) {
    background: #1a1a1a;
    border-radius: 0.25rem;
  }
</style>
