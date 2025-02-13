<script lang="ts">
  import { balances$ } from "./tokens";

  import { showWalletSelector } from "$lib/auth";
  import Button from "$lib/components/Button.svelte";
  import { evmWallet$, disconnect as disconnectEvm } from "$lib/evm/wallet";
  import type { Token } from "$lib/models/tokens";
  import { nearWallet } from "$lib/near";
  import { solanaWallet } from "$lib/solana/wallet";

  export let token: keyof typeof balances$;
  export let tokenData: Token;

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
</script>

<div
  class="w-full mt-2 bg-black rounded-xl border border-lime/20 shadow-lg py-2"
>
  <!-- NEAR Wallet Section -->
  <div class="px-4 py-2 border-b border-lime/20">
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
              <div class="flex items-center gap-2 text-sm text-lime/70 mt-1">
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
        <img src="/near-logo.webp" alt="NEAR" class="w-5 h-5 rounded-full" />
        <span class="ml-2">Connect NEAR Wallet</span>
      </Button>
    {/if}
  </div>

  <!-- Solana Wallet Section -->
  <div class="px-4 py-2 border-b border-lime/20">
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
                src={tokenData.icon}
                alt={tokenData.symbol}
                class="w-4 h-4 rounded-full"
              />
              <span class="font-medium text-lime"
                >{$balance$.solana?.format({
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
        <img src="/sol-logo.webp" alt="Solana" class="w-5 h-5 rounded-full" />
        <span class="ml-2">Connect Solana Wallet</span>
      </Button>
    {/if}
  </div>

  <!-- EVM Wallet Section -->
  <div class="px-4 py-2">
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
            {$evmWallet$.address.slice(0, 4)}...{$evmWallet$.address.slice(-4)}
          </div>
          {#if $balance$.base}
            <div class="flex items-center gap-2 text-sm text-lime/70 mt-1">
              <img
                src={tokenData.icon}
                alt={tokenData.symbol}
                class="w-4 h-4 rounded-full"
              />
              <span class="font-medium text-lime"
                >{$balance$.base?.format({
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
                src={tokenData.icon}
                alt={tokenData.symbol}
                class="w-4 h-4 rounded-full"
              />
              <span class="font-medium text-lime"
                >{$balance$.arbitrum?.format({
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
          showWalletSelector(undefined, "evm");
        }}
        class="w-full"
      >
        <img src="/evm-logo.svg" alt="EVM" class="w-5 h-5 rounded-full" />
        <span class="ml-2">Connect EVM Wallet</span>
      </Button>
    {/if}
  </div>
</div>

<style>
  :global(.bitte-wallet) {
    background: #1a1a1a;
    border-radius: 0.25rem;
  }
</style>
