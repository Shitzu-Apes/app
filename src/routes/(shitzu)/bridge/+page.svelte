<script lang="ts">
  import type { Transaction } from "@near-wallet-selector/core";
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
  import { derived } from "svelte/store";
  import { slide } from "svelte/transition";
  import { match, P } from "ts-pattern";

  import OmniBridgeSheet from "./OmniBridgeSheet.svelte";
  import TokenInfo from "./TokenInfo.svelte";
  import TransferStatus from "./TransferStatus.svelte";
  import UserMenu from "./UserMenu.svelte";
  import { trackBridgeTransfer } from "./plausible";
  import { bridgePortfolio$ } from "./portfolio";
  import {
    updateTokenBalance,
    balances$,
    TOKENS,
    getTokenBalance,
    TOKEN_ENTRIES,
    isTokenAvailableOnNetwork,
  } from "./tokens";
  import { transfers } from "./transfers";
  import { getTokenPrice } from "./utils";

  import { showWalletSelector } from "$lib/auth";
  import Button from "$lib/components/Button.svelte";
  import { addToast } from "$lib/components/Toast.svelte";
  import TokenInput from "$lib/components/TokenInput.svelte";
  import { evmWallet$, wagmiConfig, switchToChain } from "$lib/evm/wallet";
  import { openBottomSheet } from "$lib/layout/BottomSheet/Container.svelte";
  import type { Network } from "$lib/models/tokens";
  import { nearBalance, nearWallet, refreshNearBalance } from "$lib/near";
  import { solanaWallet } from "$lib/solana/wallet";
  import {
    FixedNumber,
    getFormattedNumber,
    getNumberAsUInt128,
  } from "$lib/util";

  const { accountId$, selector$ } = nearWallet;
  const { publicKey$ } = solanaWallet;

  const networks = [
    { id: "near", name: "Near", icon: "/near-logo.webp" },
    { id: "solana", name: "Solana", icon: "/sol-logo.webp" },
    { id: "base", name: "Base", icon: "/base-logo.webp" },
    { id: "arbitrum", name: "Arbitrum", icon: "/arb-logo.webp" },
    { id: "ethereum", name: "Ethereum", icon: "/evm-logo.svg" },
  ] as const;

  const sourceNetwork$ = writable<Network>("near");
  const destinationNetwork$ = writable<Network>("solana");
  let amount: TokenInput;
  $: amount$ = amount?.u128$;
  let amountValue$ = writable<string | undefined>();
  const recipientAddress$ = writable<string>("");

  const selectedToken$ = writable<keyof typeof TOKENS>("NEAR");

  let isTokenDropdownOpen = false;
  let isTokenInfoOpen = false;

  let nativeFee: bigint | undefined;
  let usdFee: number | undefined;
  let isFeeLoading = false;
  let feeTimeout: ReturnType<typeof setTimeout>;

  async function getFee() {
    if (!$amount$ || !walletConnected) return;

    isFeeLoading = true;
    try {
      const api = new OmniBridgeAPI({
        baseUrl:
          import.meta.env.VITE_NETWORK_ID === "mainnet"
            ? "https://mainnet.api.bridge.nearone.org"
            : "https://testnet.api.bridge.nearone.org",
      });

      const sender = match($sourceNetwork$)
        .with("near", () => omniAddress(ChainKind.Near, $accountId$ ?? ""))
        .with("solana", () => {
          const publicKey = $publicKey$?.toBase58();
          return publicKey ? omniAddress(ChainKind.Sol, publicKey) : undefined;
        })
        .with("base", () =>
          $evmWallet$.status === "connected"
            ? omniAddress(ChainKind.Base, $evmWallet$.address)
            : undefined,
        )
        .with("arbitrum", () =>
          $evmWallet$.status === "connected"
            ? omniAddress(ChainKind.Arb, $evmWallet$.address)
            : undefined,
        )
        .with("ethereum", () =>
          $evmWallet$.status === "connected"
            ? omniAddress(ChainKind.Eth, $evmWallet$.address)
            : undefined,
        )
        .exhaustive();

      if (!sender) return;

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
        match($sourceNetwork$)
          .with("near", () => ChainKind.Near)
          .with("solana", () => ChainKind.Sol)
          .with("base", () => ChainKind.Base)
          .with("arbitrum", () => ChainKind.Arb)
          .with("ethereum", () => ChainKind.Eth)
          .exhaustive(),
        TOKENS[$selectedToken$].addresses[$sourceNetwork$] ?? "",
      );

      const fee = await api.getFee(sender, recipient, tokenAddress);
      nativeFee = fee.native_token_fee ?? 0n;
      usdFee = fee.usd_fee;
    } catch (err) {
      console.error("Failed to fetch fee:", err);
      nativeFee = undefined;
      usdFee = undefined;
    } finally {
      isFeeLoading = false;
    }
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

      // If it's NEAR token on NEAR network, leave 0.1 NEAR for gas
      let maxAmount = currentBalance;
      if (token === "NEAR" && $sourceNetwork$ === "near") {
        const minNearBalance = new FixedNumber(100000000000000000000000n, 24); // 0.1 NEAR
        if (currentBalance.valueOf() <= minNearBalance.valueOf()) {
          addToast({
            data: {
              type: "simple",
              data: {
                title: "Insufficient Balance",
                description: "You need to keep at least 0.1 NEAR for gas fees",
                type: "error",
              },
            },
          });
          return;
        }
        maxAmount = currentBalance.sub(minNearBalance);
      }

      let quantity = getFormattedNumber(maxAmount.toString(), decimals);
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

        let amount = $amount$;
        const additionalTransactions: Omit<Transaction, "signerId">[] = [];
        if ($selectedToken$ === "NEAR") {
          const extraNearDeposit = $amount$
            .sub(get(balances$["NEAR"]).near ?? new FixedNumber(0n, 24))
            .add(get(nearBalance) ?? new FixedNumber(0n, 24));
          if (extraNearDeposit.toBigInt() > 0n) {
            additionalTransactions.push({
              receiverId: import.meta.env.VITE_WRAP_NEAR_CONTRACT_ID,
              actions: [
                {
                  type: "FunctionCall",
                  params: {
                    methodName: "near_deposit",
                    args: {},
                    gas: 30_000_000_000_000n.toString(),
                    deposit: extraNearDeposit.toU128(),
                  },
                },
              ],
            });
          }
        }

        const fee = await api.getFee(sender, recipient, tokenAddress);
        return client.initTransfer(
          {
            amount: amount.toBigInt(),
            fee: fee.transferred_token_fee ?? 0n,
            nativeFee: fee.native_token_fee ?? 0n,
            recipient,
            tokenAddress,
          },
          { additionalTransactions },
        );
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
          amount: $amount$.toBigInt(),
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
        const signer = await getEthersSigner(wagmiConfig);
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
          amount: $amount$.toBigInt(),
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
      await trackBridgeTransfer(data);
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
      await trackBridgeTransfer(data);
    }

    // Reset input fields after successful bridge
    $amountValue$ = undefined;
    $recipientAddress$ = "";
    return Promise.all([
      updateTokenBalance($selectedToken$ as keyof typeof TOKENS),
      refreshNearBalance($accountId$),
    ]);
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
    isValidAddress($recipientAddress$, $destinationNetwork$) &&
    !(
      $selectedToken$ === "NEAR" &&
      $sourceNetwork$ === "near" &&
      $amount$ &&
      (() => {
        const nearBalance = get(balances$["NEAR"]).near;
        if (!nearBalance) return false;
        const minNearBalance = new FixedNumber(100000000000000000000000n, 24);
        return $amount$.valueOf() > nearBalance.sub(minNearBalance).valueOf();
      })()
    );

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
    loadEvmTransfers($evmWallet$.address);
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

  async function loadEvmTransfers(address: string) {
    const api = new OmniBridgeAPI({
      baseUrl:
        import.meta.env.VITE_NETWORK_ID === "mainnet"
          ? "https://mainnet.api.bridge.nearone.org"
          : "https://testnet.api.bridge.nearone.org",
    });
    const findEvmTransfers = async (chainKind: ChainKind) => {
      try {
        const evmTransfers = await api.findOmniTransfers({
          sender: omniAddress(chainKind, address),
          limit: 50,
        });
        transfers.addTransfers(evmTransfers);
      } catch (err) {
        console.error(`Failed to load ${chainKind} transfers:`, err);
      }
    };
    findEvmTransfers(ChainKind.Base);
    findEvmTransfers(ChainKind.Arb);
    findEvmTransfers(ChainKind.Eth);
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
      loadEvmTransfers($evmWallet$.address);
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

  // Create a derived store that combines all token balances
  const tokenBalances$ = derived(
    TOKEN_ENTRIES.map(([tokenId]) => balances$[tokenId]),
    ($balances) => {
      return TOKEN_ENTRIES.map(([tokenId], index) => {
        const balance = $balances[index];
        const decimals = TOKENS[tokenId].decimals.near ?? 24;
        let total = new FixedNumber(0n, decimals);

        if (balance.near) total = total.add(balance.near);
        if (balance.solana) total = total.add(balance.solana);
        if (balance.base) total = total.add(balance.base);
        if (balance.arbitrum) total = total.add(balance.arbitrum);
        if (balance.ethereum) total = total.add(balance.ethereum);

        return { tokenId, balance: total };
      });
    },
  );

  // Add back availableBalance
  $: availableBalance = $currentBalance$;

  // Fix selected token balance access
  $: selectedTokenBalance =
    $tokenBalances$.find((t) => t.tokenId === $selectedToken$)?.balance ??
    new FixedNumber(0n, TOKENS[$selectedToken$].decimals.near ?? 24);

  // Close dropdown when clicking outside
  function handleClickOutside(_event: MouseEvent) {
    if (isTokenDropdownOpen) {
      isTokenDropdownOpen = false;
    }
  }

  // Add reactive statement to trigger fee fetch
  $: {
    if (
      $amount$ &&
      walletConnected &&
      $sourceNetwork$ !== $destinationNetwork$ &&
      isValidAddress($recipientAddress$, $destinationNetwork$)
    ) {
      clearTimeout(feeTimeout);
      feeTimeout = setTimeout(getFee, 500);
    } else {
      nativeFee = undefined;
    }
  }
</script>

<div class="w-full">
  <div class="text-center mb-6" class:pb-6={!walletConnected}>
    <h1 class="mb-0">OmniBridge</h1>
    <div>Transfer tokens between networks</div>
    <button
      on:click={() => openBottomSheet(OmniBridgeSheet)}
      class="inline-block mt-2 text-sm text-lime/70 hover:text-lime transition-colors"
    >
      Learn more about NEAR's next-gen cross-chain infrastructure →
    </button>
  </div>

  <div
    class="pb-8 border-2 border-lime rounded-t-xl px-3 pt-3 bg-gradient-to-r from-lime to-emerald text-black"
  >
    <!-- Token Selection -->
    <div class="flex flex-col gap-2 pb-4 border-b border-black">
      <div class="flex items-center justify-between">
        <div class="text-lg font-bold">Select Token</div>
        <button
          class="text-lime hover:text-lime/80 transition-colors p-1.5 hover:bg-black/10 rounded-lg"
          on:click={() => (isTokenInfoOpen = !isTokenInfoOpen)}
        >
          <div
            class="i-mdi:information-slab-circle-outline size-6 text-black"
          />
        </button>
      </div>
      <div class="relative">
        <button
          class="w-full flex items-center justify-between p-3 rounded-xl border border-black/20 hover:bg-black/10 transition-colors group"
          on:click|stopPropagation={() => {
            isTokenDropdownOpen = !isTokenDropdownOpen;
          }}
        >
          <div class="flex items-center gap-3">
            <img
              src={TOKENS[$selectedToken$].icon}
              alt={TOKENS[$selectedToken$].symbol}
              class="w-8 h-8 rounded-full"
            />
            <div class="flex flex-col items-start">
              <span class="text-sm font-medium"
                >{TOKENS[$selectedToken$].symbol}</span
              >
              <div
                class="flex items-center gap-1.5 text-xs font-medium text-black/80"
              >
                <span>
                  {selectedTokenBalance.format({
                    maximumSignificantDigits: 6,
                    maximumFractionDigits: 4,
                    notation: "compact",
                    compactDisplay: "short",
                  })}
                </span>
                {#if $bridgePortfolio$.prices && getTokenPrice($selectedToken$, $bridgePortfolio$.prices)}
                  <span class="text-black/60">
                    ($
                    {new FixedNumber(
                      BigInt(
                        Math.floor(
                          selectedTokenBalance.toNumber() *
                            (getTokenPrice(
                              $selectedToken$,
                              $bridgePortfolio$.prices,
                            ) ?? 0) *
                            1e24,
                        ),
                      ),
                      24,
                    ).format({
                      compactDisplay: "short",
                      notation: "compact",
                      maximumFractionDigits: 2,
                      maximumSignificantDigits: 5,
                    })})
                  </span>
                {/if}
              </div>
            </div>
          </div>
          <div
            class="i-mdi:chevron-down text-xl transition-transform"
            class:rotate-180={isTokenDropdownOpen}
          />
        </button>

        {#if isTokenDropdownOpen}
          <div
            class="absolute top-full left-0 right-0 mt-1 bg-black/90 backdrop-blur-sm border border-lime/20 rounded-xl py-2 z-20"
            transition:slide|local={{ duration: 200 }}
          >
            {#each $tokenBalances$ as { tokenId, balance }}
              {#if tokenId !== $selectedToken$}
                <button
                  class="w-full flex items-center gap-3 px-3 py-2 hover:bg-lime/10 transition-colors"
                  on:click={() => {
                    selectedToken$.set(tokenId);
                    $amountValue$ = undefined;
                    isTokenDropdownOpen = false;
                  }}
                >
                  <img
                    src={TOKENS[tokenId].icon}
                    alt={TOKENS[tokenId].symbol}
                    class="w-8 h-8 rounded-full"
                  />
                  <div class="flex flex-col items-start">
                    <span class="text-sm font-medium text-white"
                      >{TOKENS[tokenId].symbol}</span
                    >
                    <div class="flex items-center gap-1.5 text-xs text-lime/70">
                      <span>
                        {balance.format({
                          maximumSignificantDigits: 6,
                          maximumFractionDigits: 4,
                          notation: "compact",
                          compactDisplay: "short",
                        })}
                      </span>
                      {#if $bridgePortfolio$.prices && getTokenPrice(tokenId, $bridgePortfolio$.prices)}
                        <span class="opacity-75">
                          ($
                          {new FixedNumber(
                            BigInt(
                              Math.floor(
                                balance.toNumber() *
                                  (getTokenPrice(
                                    tokenId,
                                    $bridgePortfolio$.prices,
                                  ) ?? 0) *
                                  1e24,
                              ),
                            ),
                            24,
                          ).format({
                            compactDisplay: "short",
                            notation: "compact",
                            maximumFractionDigits: 2,
                            maximumSignificantDigits: 5,
                          })})
                        </span>
                      {/if}
                    </div>
                  </div>
                </button>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
      <TokenInfo
        token={TOKENS[$selectedToken$]}
        bind:isOpen={isTokenInfoOpen}
      />
    </div>

    <UserMenu token={$selectedToken$} tokenData={TOKENS[$selectedToken$]} />
  </div>

  <div
    class="-mt-6 z-10 pb-4 border-2 border-lime rounded-xl px-3 pt-3 bg-black"
  >
    <!-- Network Selection -->
    <div class="flex flex-col gap-4">
      <!-- Source Network -->
      <div class="flex flex-col gap-1">
        <div class="text-sm text-lime">From</div>
        <div class="grid grid-cols-3 gap-2">
          {#each networks.filter( (network) => isTokenAvailableOnNetwork($selectedToken$, network.id), ) as network}
            <button
              class="flex flex-col items-center gap-1 p-2 rounded-xl border {$sourceNetwork$ ===
              network.id
                ? 'bg-lime/20 border-lime'
                : 'border-lime/20 hover:bg-lime/10'} transition-colors"
              on:click={() => handleSourceNetworkChange(network.id)}
            >
              <img
                src={network.icon}
                alt={network.name}
                class="w-6 h-6 rounded-full"
              />
              <span class="text-xs font-medium">{network.name}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Destination Network -->
      <div class="flex flex-col gap-1">
        <div class="text-sm text-lime">To</div>
        <div class="grid grid-cols-3 gap-2">
          {#each networks.filter( (network) => isTokenAvailableOnNetwork($selectedToken$, network.id), ) as network}
            <button
              class="flex flex-col items-center gap-1 p-2 rounded-xl border {$destinationNetwork$ ===
              network.id
                ? 'bg-lime/20 border-lime'
                : 'border-lime/20 hover:bg-lime/10'} transition-colors"
              on:click={() => handleDestinationNetworkChange(network.id)}
            >
              <img
                src={network.icon}
                alt={network.name}
                class="w-6 h-6 rounded-full"
              />
              <span class="text-xs font-medium">{network.name}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Amount -->
      <div class="flex flex-col gap-1">
        <div class="flex justify-between items-center text-sm text-lime">
          <div class="flex items-center gap-2">
            <span>Amount</span>
            {#if $bridgePortfolio$.prices && getTokenPrice($selectedToken$, $bridgePortfolio$.prices)}
              <span class="text-lime/70">
                ≈ $
                {$amount$
                  ? new FixedNumber(
                      BigInt(
                        Math.floor(
                          $amount$.toNumber() *
                            (getTokenPrice(
                              $selectedToken$,
                              $bridgePortfolio$.prices,
                            ) ?? 0) *
                            1e24,
                        ),
                      ),
                      24,
                    ).format({
                      compactDisplay: "short",
                      notation: "compact",
                      maximumFractionDigits: 2,
                      maximumSignificantDigits: 5,
                    })
                  : "0.00"}
              </span>
            {/if}
          </div>
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
        {#if $selectedToken$ === "NEAR" && $sourceNetwork$ === "near" && $amount$}
          {#if (() => {
            const nearBalance = get(balances$["NEAR"]).near;
            if (!nearBalance) return false;
            const minNearBalance = new FixedNumber(100000000000000000000000n, 24);
            return $amount$.valueOf() > nearBalance
                .sub(minNearBalance)
                .valueOf();
          })()}
            <div transition:slide|local class="text-red-500 text-sm mt-1.5">
              You need to keep at least 0.1 NEAR for gas fees
            </div>
          {/if}
        {/if}
      </div>

      <!-- Recipient Address -->
      <div class="flex flex-col gap-1">
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

      <div class="flex flex-col gap-2">
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
        {#if isFeeLoading}
          <div class="text-center text-xs text-lime/70">Calculating fee...</div>
        {:else if nativeFee !== undefined}
          <div class="text-center text-xs text-lime/70">
            Network fee: {new FixedNumber(
              nativeFee,
              match($sourceNetwork$)
                .with("near", () => 24)
                .with("solana", () => 9)
                .with(P.union("base", "arbitrum", "ethereum"), () => 18)
                .exhaustive(),
            ).format({ maximumFractionDigits: 4 })}
            {$sourceNetwork$ === "near"
              ? "NEAR"
              : $sourceNetwork$ === "solana"
                ? "SOL"
                : "ETH"}
            {#if usdFee !== undefined}
              <span class="opacity-75">
                (${usdFee.toFixed(2)})
              </span>
            {/if}
          </div>
        {/if}
      </div>
    </div>

    <!-- Recent Transfers -->
    {#if $transfers.length > 0}
      <div class="flex flex-col gap-1.5 mt-4 pt-4 border-t border-lime">
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

<svelte:window on:click={handleClickOutside} />
