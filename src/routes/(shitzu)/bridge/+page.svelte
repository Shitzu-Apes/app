<script lang="ts">
  import { getConnectorClient, type Config } from "@wagmi/core";
  import {
    arbitrum,
    arbitrumSepolia,
    base,
    baseSepolia,
    mainnet,
    sepolia,
  } from "@wagmi/core/chains";
  import { BrowserProvider, JsonRpcSigner } from "ethers";
  import {
    ChainKind,
    getClient,
    omniAddress,
    OmniBridgeAPI,
    type Chain,
    type Transfer,
  } from "omni-bridge-sdk";
  import { writable, get } from "svelte/store";
  import { slide } from "svelte/transition";
  import { match, P } from "ts-pattern";

  import TransferStatus from "./TransferStatus.svelte";
  import UserMenu from "./UserMenu.svelte";
  import {
    updateTokenBalance,
    balances$,
    TOKENS,
    getTokenBalance,
    TOKEN_ENTRIES,
    isTokenAvailableOnNetwork,
  } from "./tokens";
  import { transfers } from "./transfers";

  import { showWalletSelector } from "$lib/auth";
  import Button from "$lib/components/Button.svelte";
  import { addToast } from "$lib/components/Toast.svelte";
  import TokenInput from "$lib/components/TokenInput.svelte";
  import { evmWallet$, config, switchToChain } from "$lib/evm/wallet";
  import type { Network } from "$lib/models/tokens";
  import { nearWallet } from "$lib/near";
  import { solanaWallet } from "$lib/solana/wallet";
  import {
    FixedNumber,
    getFormattedNumber,
    getNumberAsUInt128,
  } from "$lib/util";

  const { accountId$, selector$ } = nearWallet;
  const { publicKey$ } = solanaWallet;

  const networks = [
    {
      id: "near",
      name: "Near",
      icon: "/near-logo.webp",
    },
    {
      id: "solana",
      name: "Solana",
      icon: "/sol-logo.webp",
    },
    {
      id: "base",
      name: "Base",
      icon: "/base-logo.webp",
    },
    {
      id: "arbitrum",
      name: "Arbitrum",
      icon: "/arb-logo.webp",
    },
    {
      id: "ethereum",
      name: "Ethereum",
      icon: "/evm-logo.svg",
    },
  ] as const;

  const sourceNetwork$ = writable<Network>("near");
  const destinationNetwork$ = writable<Network>("solana");
  let amount: TokenInput;
  $: amount$ = amount?.u128$;
  let amountValue$ = writable<string | undefined>();
  const recipientAddress$ = writable<string>("");

  const selectedToken$ = writable<keyof typeof TOKENS>("NEAR");

  function handleSwapNetworks() {
    const source = $sourceNetwork$;
    const destination = $destinationNetwork$;
    sourceNetwork$.set(destination);
    destinationNetwork$.set(source);
  }

  function handleSourceNetworkChange(network: Network) {
    if (network === $destinationNetwork$) {
      // If selecting same network as destination, swap them
      destinationNetwork$.set($sourceNetwork$);
    }
    sourceNetwork$.set(network);
    $amountValue$ = undefined;
    $recipientAddress$ = "";
  }

  function handleDestinationNetworkChange(network: Network) {
    if (network === $sourceNetwork$) {
      // If selecting same network as source, swap them
      sourceNetwork$.set($destinationNetwork$);
    }
    destinationNetwork$.set(network);
    // Reset recipient address when destination changes
    recipientAddress$.set("");
  }

  function handleMaxAmount(token: keyof typeof TOKENS) {
    const currentBalance = match($sourceNetwork$)
      .with("near", () => get(balances$[token]).near)
      .with("solana", () => get(balances$[token]).solana)
      .with("base", () => get(balances$[token]).base)
      .with("arbitrum", () => get(balances$[token]).arbitrum)
      .with("ethereum", () => get(balances$[token]).ethereum)
      .exhaustive();

    if (currentBalance) {
      const decimals = Math.min(
        TOKENS[$selectedToken$].decimals[$sourceNetwork$] ?? 24,
        TOKENS[$selectedToken$].decimals[$destinationNetwork$] ?? 24,
      );
      let quantity = getFormattedNumber(currentBalance.toString(), decimals);
      const [res] = getNumberAsUInt128(quantity, decimals);
      $amountValue$ = new FixedNumber(res, decimals).toString();
    }
  }

  function handleFillRecipient() {
    match($destinationNetwork$)
      .with("solana", () => {
        if ($publicKey$) {
          $recipientAddress$ = $publicKey$.toBase58();
        } else {
          showWalletSelector(undefined, "solana");
        }
      })
      .with(P.union("base", "arbitrum", "ethereum"), () => {
        if ($evmWallet$.status === "connected") {
          $recipientAddress$ = $evmWallet$.address;
        } else {
          showWalletSelector(undefined, "base");
        }
      })
      .with("near", () => {
        if ($accountId$) {
          $recipientAddress$ = $accountId$;
        } else {
          showWalletSelector(undefined, "near");
        }
      })
      .exhaustive();
  }

  function getWalletButtonText(network: Network): string {
    return match(network)
      .with("solana", () => ($publicKey$ ? "Use Wallet" : "Connect Wallet"))
      .with(P.union("base", "arbitrum", "ethereum"), () =>
        $evmWallet$.status === "connected" ? "Use Wallet" : "Connect Wallet",
      )
      .with("near", () => ($accountId$ ? "Use Wallet" : "Connect Wallet"))
      .exhaustive();
  }

  async function getEthersSigner(config: Config) {
    const evmWallet = $evmWallet$;
    const client = await getConnectorClient(config, {
      chainId: evmWallet.chainId,
      connector: evmWallet.connector,
      account: evmWallet.address,
    });
    const chain =
      import.meta.env.VITE_NETWORK_ID === "mainnet" ? base : baseSepolia;
    const network = {
      chainId: chain.id,
      name: chain.name,
      ensAddress: client.chain?.contracts?.ensRegistry?.address,
    };
    const provider = new BrowserProvider(client.transport, network);
    const signer = new JsonRpcSigner(provider, client.account.address);
    return signer;
  }

  async function handleBridge() {
    if (needsWalletConnection) {
      showWalletSelector(undefined, $sourceNetwork$);
      return;
    }

    if (!$amount$) {
      return;
    }

    const amount = $amount$.toU128();
    const api = new OmniBridgeAPI({
      baseUrl:
        import.meta.env.VITE_NETWORK_ID === "mainnet"
          ? "https://mainnet.api.bridge.nearone.org"
          : "https://testnet.api.bridge.nearone.org",
    });

    const rawTransferEvent = await match($sourceNetwork$)
      .with("near", async () => {
        const selector = await $selector$;

        const client = getClient(ChainKind.Near, selector);

        const sender = omniAddress(ChainKind.Near, $accountId$ ?? "");
        const recipient = omniAddress(
          match($destinationNetwork$)
            .with("near", () => ChainKind.Near)
            .with("solana", () => ChainKind.Sol)
            .with("base", () => ChainKind.Base)
            .with("arbitrum", () => ChainKind.Arb)
            .with("ethereum", () => ChainKind.Eth)
            .exhaustive(),
          $recipientAddress$,
        );
        const tokenAddress = omniAddress(
          ChainKind.Near,
          TOKENS[$selectedToken$].addresses.near,
        );

        const fee = await api.getFee(sender, recipient, tokenAddress);
        return client.initTransfer({
          amount: BigInt(amount),
          fee: fee.transferred_token_fee ?? 0n,
          nativeFee: fee.native_token_fee ?? 0n,
          recipient,
          tokenAddress,
        });
      })
      .with("solana", async () => {
        const wallet = get(solanaWallet.selectedWallet$);
        if (!wallet) return;
        const publicKey = $publicKey$?.toBase58();
        if (!publicKey) return;

        const provider = solanaWallet.getProvider();
        if (!provider) {
          console.error("Provider not connected.");
          return;
        }
        const client = getClient(ChainKind.Sol, provider);

        const sender = omniAddress(ChainKind.Sol, publicKey);
        const recipient = omniAddress(
          match($destinationNetwork$)
            .with("near", () => ChainKind.Near)
            .with("solana", () => ChainKind.Sol)
            .with("base", () => ChainKind.Base)
            .with("arbitrum", () => ChainKind.Arb)
            .with("ethereum", () => ChainKind.Eth)
            .exhaustive(),
          $recipientAddress$,
        );
        const tokenAddress = omniAddress(
          ChainKind.Sol,
          TOKENS[$selectedToken$].addresses.solana,
        );

        const fee = await api.getFee(sender, recipient, tokenAddress);
        return client.initTransfer({
          amount: BigInt(amount) / 1_000_000_000n,
          fee: fee.transferred_token_fee ?? 0n,
          nativeFee: fee.native_token_fee ?? 0n,
          recipient,
          tokenAddress,
        });
      })
      .with(P.select(), async (network) => {
        if ($evmWallet$.status !== "connected") return;

        // Check if we're on the correct network
        const targetChainId = match([
          network,
          import.meta.env.VITE_NETWORK_ID === "mainnet",
        ])
          .with(["base", true], () => base.id)
          .with(["base", false], () => baseSepolia.id)
          .with(["arbitrum", true], () => arbitrum.id)
          .with(["arbitrum", false], () => arbitrumSepolia.id)
          .with(["ethereum", true], () => mainnet.id)
          .with(["ethereum", false], () => sepolia.id)
          .exhaustive();
        if ($evmWallet$.chainId !== targetChainId) {
          try {
            await switchToChain(targetChainId);
          } catch (error) {
            console.error("Failed to switch network:", error);
            addToast({
              data: {
                type: "simple",
                data: {
                  title: "Network Switch Failed",
                  description: "Please switch to Base network to continue.",
                  type: "error",
                },
              },
            });
            return;
          }
        }

        // Get ethers signer
        const signer = await getEthersSigner(config);
        const client = getClient(ChainKind.Base, signer);

        const sender = omniAddress(ChainKind.Base, $evmWallet$.address);
        const recipient = omniAddress(
          match($destinationNetwork$)
            .with("near", () => ChainKind.Near)
            .with("solana", () => ChainKind.Sol)
            .with("base", () => ChainKind.Base)
            .with("arbitrum", () => ChainKind.Arb)
            .with("ethereum", () => ChainKind.Eth)
            .exhaustive(),
          $recipientAddress$,
        );
        const tokenAddress = omniAddress(
          ChainKind.Base,
          TOKENS[$selectedToken$].addresses[network] ?? "",
        );

        const fee = await api.getFee(sender, recipient, tokenAddress);
        return client.initTransfer({
          amount: BigInt(amount),
          fee: fee.transferred_token_fee ?? 0n,
          nativeFee: fee.native_token_fee ?? 0n,
          recipient,
          tokenAddress,
        });
      })
      .exhaustive();

    console.log("[transferEvent]", rawTransferEvent);
    if (!rawTransferEvent) {
      throw new Error("Failed to initiate transfer");
    }

    const chain: Chain = match($sourceNetwork$)
      .with("near", () => "Near" as const)
      .with("solana", () => "Sol" as const)
      .with("base", () => "Base" as const)
      .with("arbitrum", () => "Arb" as const)
      .with("ethereum", () => "Eth" as const)
      .exhaustive();

    if (typeof rawTransferEvent === "string") {
      // Wait for transaction to be indexed
      let data: Transfer | undefined;
      for (let i = 0; i < 20; i++) {
        // Try up to 10 times
        await new Promise((resolve) => setTimeout(resolve, 3_000)); // Wait 2s between attempts
        try {
          // First find the transfer to get the nonce
          const transfers = await api.findOmniTransfers({
            transaction_id: rawTransferEvent,
          });
          if (transfers.length > 0) {
            // Then get the full transfer data
            data = await api.getTransfer(
              transfers[0].id.origin_chain,
              transfers[0].id.origin_nonce,
            );
            break;
          }
        } catch (err) {
          console.error("Failed to fetch transfer:", err);
          continue;
        }
      }

      if (!data) {
        throw new Error("Failed to fetch transfer data after multiple retries");
      }
      console.log("[data]", data);

      transfers.addTransfers([data]);
    } else {
      console.log("[rawTransferEvent]", rawTransferEvent);
      // For non-string transfer events, we need to wait for them to be indexed
      // This ensures we have the full transfer data structure
      let data: Transfer | undefined;
      for (let i = 0; i < 20; i++) {
        // Try up to 10 times
        await new Promise((resolve) => setTimeout(resolve, 3_000)); // Wait 2s between attempts
        try {
          data = await api.getTransfer(
            chain,
            rawTransferEvent.transfer_message.origin_nonce,
          );
          if (data) {
            break;
          }
        } catch (err) {
          console.error("Failed to fetch transfer:", err);
          continue;
        }
      }

      if (!data) {
        throw new Error("Failed to fetch transfer data after multiple retries");
      }
      console.log("[data]", data);

      transfers.addTransfers([data]);
    }

    // Reset input fields after successful bridge
    $amountValue$ = undefined;
    $recipientAddress$ = "";
    return updateTokenBalance($selectedToken$ as keyof typeof TOKENS);
  }

  function isValidAddress(address: string, network: Network): boolean {
    if (!address) return false;

    return match(network)
      .with("near", () => Boolean(address.match(/^[0-9a-zA-Z.-_]+$/)))
      .with("solana", () => Boolean(address.match(/^[0-9a-zA-Z]{44}$/)))
      .with(P.union("base", "arbitrum", "ethereum"), () =>
        Boolean(address.match(/^0x[0-9a-fA-F]{40}$/)),
      )
      .exhaustive();
  }

  $: walletConnected = match($sourceNetwork$)
    .with("near", () => Boolean($accountId$))
    .with("solana", () => Boolean($publicKey$))
    .with(
      P.union("base", "arbitrum", "ethereum"),
      () => $evmWallet$.status === "connected",
    )
    .exhaustive();

  $: currentBalance$ = getTokenBalance($sourceNetwork$, $selectedToken$);

  $: canBridge =
    Boolean($amount$) &&
    walletConnected &&
    $sourceNetwork$ !== $destinationNetwork$ &&
    $amount$ &&
    $amount$.valueOf() <= $currentBalance$.valueOf() &&
    isValidAddress($recipientAddress$, $destinationNetwork$);

  $: needsWalletConnection = match($sourceNetwork$)
    .with("near", () => !$accountId$)
    .with("solana", () => !$publicKey$)
    .with(
      P.union("base", "arbitrum", "ethereum"),
      () => $evmWallet$.status !== "connected",
    )
    .exhaustive();

  // Add these reactive statements for each wallet
  $: if ($accountId$) {
    loadNearTransfers($accountId$);
  } else {
    transfers.removeTransfersByChain("Near");
  }

  $: if ($publicKey$) {
    loadSolanaTransfers($publicKey$.toBase58());
  } else {
    transfers.removeTransfersByChain("Sol");
  }

  $: if ($evmWallet$.status === "connected") {
    loadBaseTransfers($evmWallet$.address);
  } else {
    transfers.removeTransfersByChain("Base");
  }

  async function loadNearTransfers(accountId: string) {
    const api = new OmniBridgeAPI({
      baseUrl:
        import.meta.env.VITE_NETWORK_ID === "mainnet"
          ? "https://mainnet.api.bridge.nearone.org"
          : "https://testnet.api.bridge.nearone.org",
    });
    try {
      const nearTransfers = await api.findOmniTransfers({
        sender: `near:${accountId}`,
        limit: 50,
      });
      transfers.addTransfers(nearTransfers);
    } catch (err) {
      console.error("Failed to load NEAR transfers:", err);
    }
  }

  async function loadSolanaTransfers(publicKey: string) {
    const api = new OmniBridgeAPI({
      baseUrl:
        import.meta.env.VITE_NETWORK_ID === "mainnet"
          ? "https://mainnet.api.bridge.nearone.org"
          : "https://testnet.api.bridge.nearone.org",
    });
    try {
      const solTransfers = await api.findOmniTransfers({
        sender: `sol:${publicKey}`,
        limit: 50,
      });
      transfers.addTransfers(solTransfers);
    } catch (err) {
      console.error("Failed to load Solana transfers:", err);
    }
  }

  async function loadBaseTransfers(address: string) {
    const api = new OmniBridgeAPI({
      baseUrl:
        import.meta.env.VITE_NETWORK_ID === "mainnet"
          ? "https://mainnet.api.bridge.nearone.org"
          : "https://testnet.api.bridge.nearone.org",
    });
    try {
      const baseTransfers = await api.findOmniTransfers({
        sender: `base:${address}`,
        limit: 50,
      });
      transfers.addTransfers(baseTransfers);
    } catch (err) {
      console.error("Failed to load Base transfers:", err);
    }
  }

  let isLoadingMore = false;
  let visibleCount = 10;

  function handleLoadMore() {
    if (isLoadingMore) return;
    isLoadingMore = true;
    try {
      visibleCount += 10;
    } finally {
      isLoadingMore = false;
    }
  }

  $: visibleTransfers = $transfers.slice(0, visibleCount);
  $: hasMore = visibleCount < $transfers.length;

  // Load initial transfers when wallets change
  $: if ($accountId$ || $publicKey$ || $evmWallet$.status === "connected") {
    transfers.clear();
    if ($accountId$) loadNearTransfers($accountId$);
    if ($publicKey$) loadSolanaTransfers($publicKey$.toBase58());
    if ($evmWallet$.status === "connected")
      loadBaseTransfers($evmWallet$.address);
    visibleCount = 10;
  }

  // Add this near your other reactive statements
  $: {
    // When token changes, validate current network selections
    if (!isTokenAvailableOnNetwork($selectedToken$, $sourceNetwork$)) {
      // Find first available network for this token
      const firstAvailable = networks.find((n) =>
        isTokenAvailableOnNetwork($selectedToken$, n.id),
      );
      if (firstAvailable) {
        sourceNetwork$.set(firstAvailable.id);
      }
    }
    if (!isTokenAvailableOnNetwork($selectedToken$, $destinationNetwork$)) {
      // Find first available network that's not the source
      const firstAvailable = networks.find(
        (n) =>
          isTokenAvailableOnNetwork($selectedToken$, n.id) &&
          n.id !== $sourceNetwork$,
      );
      if (firstAvailable) {
        destinationNetwork$.set(firstAvailable.id);
      }
    }
  }

  // Add this with your other reactive declarations
  $: availableBalance = $currentBalance$;
</script>

<div class="w-full">
  <div class="text-center mb-6" class:pb-6={!walletConnected}>
    <h1 class="mb-0">Omni Bridge</h1>
    <div>Transfer tokens between networks</div>
  </div>

  <div
    class="pb-12 border-2 border-lime rounded-t-xl px-3 pt-3 bg-gradient-to-r from-lime to-emerald text-black"
  >
    <!-- Token Selection -->
    <div class="flex flex-col gap-3 pb-6 border-b border-black">
      <div class="text-lg font-bold">Select Token</div>
      <div class="grid grid-cols-1 gap-2">
        {#each TOKEN_ENTRIES as [tokenId, token]}
          <button
            class="flex items-center gap-3 p-3 rounded-xl border {$selectedToken$ ===
            tokenId
              ? 'bg-black/20 border-black'
              : 'border-black/20 hover:bg-black/10'} transition-colors"
            on:click={() => {
              selectedToken$.set(tokenId);
              $amountValue$ = undefined;
            }}
          >
            <img
              src={token.icon}
              alt={token.symbol}
              class="w-8 h-8 rounded-full"
            />
            <span class="text-sm font-medium">{token.symbol}</span>
          </button>
        {/each}
      </div>
    </div>

    <UserMenu token={$selectedToken$} tokenData={TOKENS[$selectedToken$]} />
  </div>

  <div
    class="-mt-6 z-10 pb-6 border-2 border-lime rounded-xl px-3 pt-3 bg-black"
  >
    <!-- Network Selection -->
    <div class="flex flex-col gap-5">
      <!-- Source Network -->
      <div class="flex flex-col gap-1.5">
        <div class="text-sm text-lime">From</div>
        <div class="grid grid-cols-3 gap-2">
          {#each networks.filter( (network) => isTokenAvailableOnNetwork($selectedToken$, network.id), ) as network}
            <button
              class="flex flex-col items-center gap-1.5 p-3 rounded-xl border {$sourceNetwork$ ===
              network.id
                ? 'bg-lime/20 border-lime'
                : 'border-lime/20 hover:bg-lime/10'} transition-colors"
              on:click={() => handleSourceNetworkChange(network.id)}
            >
              <img
                src={network.icon}
                alt={network.name}
                class="w-8 h-8 rounded-full"
              />
              <span class="text-sm font-medium">{network.name}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Swap Button -->
      <div class="flex justify-center">
        <button
          class="p-2 rounded-lg hover:bg-lime/10 transition-colors"
          on:click={handleSwapNetworks}
          aria-label="Swap networks"
        >
          <div class="i-mdi:swap-vertical text-2xl text-lime/70" />
        </button>
      </div>

      <!-- Destination Network -->
      <div class="flex flex-col gap-1.5">
        <div class="text-sm text-lime">To</div>
        <div class="grid grid-cols-3 gap-2">
          {#each networks.filter( (network) => isTokenAvailableOnNetwork($selectedToken$, network.id), ) as network}
            <button
              class="flex flex-col items-center gap-1.5 p-3 rounded-xl border {$destinationNetwork$ ===
              network.id
                ? 'bg-lime/20 border-lime'
                : 'border-lime/20 hover:bg-lime/10'} transition-colors"
              on:click={() => handleDestinationNetworkChange(network.id)}
            >
              <img
                src={network.icon}
                alt={network.name}
                class="w-8 h-8 rounded-full"
              />
              <span class="text-sm font-medium">{network.name}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Amount -->
      <div class="flex flex-col gap-1.5">
        <div class="flex justify-between items-center text-sm text-lime">
          <div>Amount</div>
          <div class="flex items-center gap-1">
            Available:
            {#if availableBalance.valueOf() > 0n}
              <span class="font-medium flex items-center gap-1">
                <img
                  src={TOKENS[$selectedToken$].icon}
                  alt={TOKENS[$selectedToken$].symbol}
                  class="w-4 h-4 rounded-full"
                />
                {availableBalance.format({
                  maximumSignificantDigits: 8,
                  maximumFractionDigits: 6,
                })}
                {TOKENS[$selectedToken$].symbol}
              </span>
            {:else}
              <span>-</span>
            {/if}
          </div>
        </div>
        <div class="relative">
          <div
            class="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10"
          >
            <img
              src={TOKENS[$selectedToken$].icon}
              alt={TOKENS[$selectedToken$].symbol}
              class="w-5 h-5 rounded-full"
            />
          </div>
          <TokenInput
            bind:this={amount}
            bind:value={$amountValue$}
            decimals={TOKENS[$selectedToken$].decimals[$sourceNetwork$] ?? 24}
            maxDecimals={Math.min(
              TOKENS[$selectedToken$].decimals[$sourceNetwork$] ?? 24,
              TOKENS[$selectedToken$].decimals[$destinationNetwork$] ?? 24,
            )}
            class="w-full bg-black text-white border border-lime/20 rounded-xl pl-10 py-3 focus:outline-none focus:ring-2 focus:ring-lime/50"
            placeholder="0.0"
          />
          {#if $currentBalance$.valueOf() > 0n}
            <button
              on:click={() => handleMaxAmount($selectedToken$)}
              class="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-lime/70 hover:text-lime hover:bg-lime/10 px-2 py-0.5 rounded transition-colors z-10"
            >
              Max
            </button>
          {/if}
        </div>
      </div>

      <!-- Recipient Address -->
      <div class="flex flex-col gap-1.5">
        <div class="text-sm text-lime">Recipient Address</div>
        <div class="relative">
          <input
            type="text"
            bind:value={$recipientAddress$}
            class="w-full bg-black text-white border border-lime/20 rounded-xl pl-4 pr-[120px] py-3 focus:outline-none focus:ring-2 focus:ring-lime/50"
            placeholder="{networks.find((n) => n.id === $destinationNetwork$)
              ?.name} address"
          />
          <button
            on:click={handleFillRecipient}
            class="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-lime/70 hover:text-lime hover:bg-lime/10 px-2 py-0.5 rounded transition-colors z-10"
          >
            {getWalletButtonText($destinationNetwork$)}
          </button>
        </div>
      </div>

      <Button
        onClick={handleBridge}
        disabled={!needsWalletConnection && !canBridge}
        class="w-full"
      >
        {#if needsWalletConnection}
          Connect Wallet
        {:else if !$amount$}
          Enter Amount
        {:else}
          Bridge {$amount$.format({
            compactDisplay: "short",
            notation: "compact",
            maximumFractionDigits: 4,
            maximumSignificantDigits: 8,
          })}
          {TOKENS[$selectedToken$].symbol}
        {/if}
      </Button>
    </div>

    <!-- Recent Transfers -->
    {#if $transfers.length > 0}
      <div class="flex flex-col gap-2 mt-6 pt-6 border-t border-lime">
        <div class="text-sm text-lime">Recent Transfers</div>
        <div class="flex flex-col gap-1.5">
          {#each visibleTransfers as transfer (transfer.id.origin_chain + ":" + transfer.id.origin_nonce)}
            <div in:slide|global class="flex flex-col">
              <TransferStatus {transfer} />
            </div>
          {/each}
          {#if hasMore}
            <button
              on:click={handleLoadMore}
              disabled={isLoadingMore}
              class="mt-2 px-4 py-2 rounded-lg bg-lime/10 hover:bg-lime/20 text-lime/70 hover:text-lime transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {#if isLoadingMore}
                <div class="i-mdi:loading animate-spin" />
                Loading...
              {:else}
                Load More
              {/if}
            </button>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <!-- Notes Section -->
  <div class="mt-6 flex flex-col gap-1.5 text-sm text-lime/70">
    <p>Note:</p>
    <ul class="list-disc list-inside flex flex-col gap-1">
      <li>
        Bridge fees may apply depending on the source and destination network
      </li>
      <li>Estimated transfer times:</li>
      <ul class="list-[circle] list-inside ml-4 flex flex-col gap-1">
        <li>NEAR to EVM/Solana: ~30 seconds</li>
        <li>Solana to NEAR: ~30 seconds</li>
        <li>EVM to NEAR: ~20 minutes</li>
      </ul>
    </ul>
  </div>
</div>
