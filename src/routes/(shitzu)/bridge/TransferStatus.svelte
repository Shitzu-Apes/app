<script lang="ts">
  import dayjs from "dayjs";
  import { OmniBridgeAPI, type Transfer } from "omni-bridge-sdk";
  import { onMount } from "svelte";
  import { match, P } from "ts-pattern";

  import { updateTokenBalance, findTokenByAddress, TOKENS } from "./tokens";
  import { transfers } from "./transfers";

  import { FixedNumber } from "$lib/util";

  export let transfer: Transfer;

  $: amount = transfer.transfer_message?.amount;

  $: tokenKey = findTokenByAddress(
    transfer.id?.origin_chain ?? "",
    transfer.transfer_message?.token ?? "",
  );
  $: token = tokenKey ? TOKENS[tokenKey] : undefined;

  let pollInterval: ReturnType<typeof setInterval>;

  function getTransferDuration(sourceChain: string): number {
    return match(sourceChain)
      .with("Base", () => 20 * 60 * 1000) // 20 minutes
      .otherwise(() => 30 * 1000); // 30 seconds
  }

  function getTransferEta(transfer: Transfer): string {
    const startTime = dayjs(
      (transfer.initialized?.NearReceipt?.block_timestamp_seconds ??
        transfer.initialized?.EVMLog?.block_timestamp_seconds ??
        transfer.initialized?.Solana?.block_timestamp_seconds ??
        Date.now() / 1000) * 1000,
    );
    const duration = getTransferDuration(transfer.id?.origin_chain ?? "");
    return startTime.add(duration, "millisecond").format("h:mm A");
  }

  $: estimatedCompletion = getTransferEta(transfer);

  $: formattedAmount = match([transfer.id?.origin_chain ?? "", token])
    .with([P.any, P.nullish], () => undefined)
    .with(
      ["Near", P.select()],
      (token) => new FixedNumber(String(amount), token!.decimals.near),
    )
    .with(
      ["Sol", P.select()],
      (token) => new FixedNumber(String(amount), token!.decimals.solana),
    )
    .with(
      ["Base", P.select()],
      (token) => new FixedNumber(String(amount), token!.decimals.base),
    )
    .with(
      ["Arb", P.select()],
      (token) => new FixedNumber(String(amount), token!.decimals.arbitrum),
    )
    .with(
      ["Eth", P.select()],
      (token) => new FixedNumber(String(amount), token!.decimals.ethereum),
    )
    .with(
      ["Bnb", P.select()],
      (token) => new FixedNumber(String(amount), token!.decimals.bnb),
    )
    .with(["", P.any], () => undefined)
    .exhaustive();

  function getChainIcon(chainId: string): string {
    return match(chainId as "near" | "sol" | "base" | "arb" | "eth")
      .with("near", () => "/near-logo.webp")
      .with("sol", () => "/sol-logo.webp")
      .with("base", () => "/base-logo.webp")
      .with("arb", () => "/arb-logo.webp")
      .with("eth", () => "/evm-logo.svg")
      .exhaustive();
  }

  function getExplorerUrl(
    chain: string,
    address: string,
    type: "address" | "tx" = "address",
  ): string {
    return match(chain as "near" | "sol" | "base" | "arb" | "eth")
      .with(
        "near",
        () =>
          `https://${import.meta.env.VITE_NETWORK_ID === "mainnet" ? "" : "testnet."}nearblocks.io/${type === "address" ? "address" : "txns"}/${address}`,
      )
      .with(
        "sol",
        () =>
          `https://solscan.io/${type === "address" ? "account" : "tx"}/${address}`,
      )
      .with(
        "base",
        () =>
          `https://${import.meta.env.VITE_NETWORK_ID === "mainnet" ? "" : "sepolia."}basescan.org/${type === "address" ? "address" : "tx"}/${address}`,
      )
      .with(
        "arb",
        () =>
          `https://${import.meta.env.VITE_NETWORK_ID === "mainnet" ? "" : "sepolia."}arbiscan.io/${type === "address" ? "address" : "tx"}/${address}`,
      )
      .with(
        "eth",
        () =>
          `https://${import.meta.env.VITE_NETWORK_ID === "mainnet" ? "" : "sepolia."}etherscan.io/${type === "address" ? "address" : "tx"}/${address}`,
      )
      .exhaustive();
  }

  function formatAddress(address: string): string {
    if (address.length > 24) {
      return `${address.slice(0, 12)}...${address.slice(-4)}`;
    }
    return address;
  }

  async function pollStatus() {
    if (transfer.id == null) {
      return;
    }

    const api = new OmniBridgeAPI({
      baseUrl:
        import.meta.env.VITE_NETWORK_ID === "mainnet"
          ? "https://mainnet.api.bridge.nearone.org"
          : "https://testnet.api.bridge.nearone.org",
    });
    try {
      const updatedTransfer = (
        await api.getTransfer({
          originChain: transfer.id.origin_chain,
          originNonce: transfer.id.origin_nonce,
        })
      )[0];

      transfers.updateTransfer({
        event: updatedTransfer,
        chain: transfer.id.origin_chain,
      });

      if (
        updatedTransfer.finalised != null &&
        updatedTransfer.transfer_message != null
      ) {
        clearInterval(pollInterval);
        const [chain, address] =
          updatedTransfer.transfer_message.token.split(":");
        const token = findTokenByAddress(chain, address);

        if (token) {
          await updateTokenBalance(token);
        }
      }
    } catch (err) {
      console.error(
        `[Transfer ${transfer.id.origin_chain}:${transfer.id.origin_nonce}] Error:`,
        err,
      );
    }
  }

  onMount(() => {
    // Start polling
    pollInterval = setInterval(pollStatus, 5_000);
    pollStatus(); // Initial check

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  });
</script>

<div class="flex flex-col gap-3 p-3 bg-lime/10 rounded-lg">
  <div class="flex items-center justify-between">
    <div class="flex flex-col gap-1">
      <div class="text-sm font-medium flex items-center gap-1">
        {#if token && formattedAmount}
          {formattedAmount.format({
            compactDisplay: "short",
            notation: "compact",
            maximumFractionDigits: 3,
            maximumSignificantDigits: 8,
          })}
          <img
            src={token.icon}
            alt={token.symbol}
            class="inline w-4 h-4 rounded-full"
          />
          {token.symbol}
        {/if}
      </div>
      <div class="text-xs text-lime/70">
        {new Date(
          (transfer.initialized?.NearReceipt?.block_timestamp_seconds ??
            transfer.initialized?.EVMLog?.block_timestamp_seconds ??
            transfer.initialized?.Solana?.block_timestamp_seconds ??
            Date.now() / 1_000) * 1_000,
        ).toLocaleString()}
      </div>
    </div>
    <div class="flex items-center gap-2 text-sm">
      {#if transfer.finalised != null}
        <div class="i-mdi:check-circle text-emerald-500 text-xl" />
        <span class="text-emerald-500">Transfer completed</span>
      {:else}
        <div class="i-mdi:loading animate-spin text-lime/70 text-xl" />
        <div class="flex flex-col items-end">
          <span class="text-lime/70">Transfer in progress...</span>
          <span class="text-xs text-lime/50"
            >Est. completion: {estimatedCompletion}</span
          >
        </div>
      {/if}
    </div>
  </div>

  <!-- Sender and Recipient -->
  <div class="flex flex-col gap-1.5 text-sm">
    {#if transfer.transfer_message?.sender}
      {@const [senderChain, senderAddress] =
        transfer.transfer_message.sender.split(":")}
      <div class="flex items-center gap-2">
        <span class="text-lime/70">From:</span>
        <div class="flex items-center gap-1.5">
          <img
            src={getChainIcon(senderChain)}
            alt={senderChain}
            class="w-4 h-4 rounded-full"
          />
          <a
            href={getExplorerUrl(senderChain, senderAddress)}
            target="_blank"
            rel="noopener noreferrer"
            class="text-lime hover:text-lime/80 transition-colors flex items-center gap-1"
          >
            <span>{formatAddress(senderAddress)}</span>
            <div class="i-mdi:open-in-new text-sm opacity-70" />
          </a>
          {#if transfer.initialized?.NearReceipt?.transaction_hash}
            <a
              href={getExplorerUrl(
                "near",
                transfer.initialized.NearReceipt.transaction_hash,
                "tx",
              )}
              target="_blank"
              rel="noopener noreferrer"
              class="text-lime/70 hover:text-lime transition-colors"
              title="View source transaction"
              aria-label="View source transaction"
            >
              <div class="i-mdi:link-variant text-sm" />
            </a>
          {:else if transfer.initialized?.Solana?.signature}
            <a
              href={getExplorerUrl(
                "sol",
                transfer.initialized.Solana.signature,
                "tx",
              )}
              target="_blank"
              rel="noopener noreferrer"
              class="text-lime/70 hover:text-lime transition-colors"
              title="View source transaction"
              aria-label="View source transaction"
            >
              <div class="i-mdi:link-variant text-sm" />
            </a>
          {:else if transfer.initialized?.EVMLog?.transaction_hash}
            <a
              href={getExplorerUrl(
                senderChain,
                transfer.initialized.EVMLog.transaction_hash,
                "tx",
              )}
              target="_blank"
              rel="noopener noreferrer"
              class="text-lime/70 hover:text-lime transition-colors"
              title="View source transaction"
              aria-label="View source transaction"
            >
              <div class="i-mdi:link-variant text-sm" />
            </a>
          {/if}
        </div>
      </div>
    {/if}
    {#if transfer.transfer_message?.recipient}
      {@const [recipientChain, recipientAddress] =
        transfer.transfer_message.recipient.split(":")}
      <div class="flex items-center gap-2">
        <span class="text-lime/70">To:</span>
        <div class="flex items-center gap-1.5">
          <img
            src={getChainIcon(recipientChain)}
            alt={recipientChain}
            class="w-4 h-4 rounded-full"
          />
          <a
            href={getExplorerUrl(recipientChain, recipientAddress)}
            target="_blank"
            rel="noopener noreferrer"
            class="text-lime hover:text-lime/80 transition-colors flex items-center gap-1"
          >
            <span>{formatAddress(recipientAddress)}</span>
            <div class="i-mdi:open-in-new text-sm opacity-70" />
          </a>
          {#if transfer.finalised?.NearReceipt?.transaction_hash}
            <a
              href={getExplorerUrl(
                "near",
                transfer.finalised.NearReceipt.transaction_hash,
                "tx",
              )}
              target="_blank"
              rel="noopener noreferrer"
              class="text-lime/70 hover:text-lime transition-colors"
              title="View destination transaction"
              aria-label="View destination transaction"
            >
              <div class="i-mdi:link-variant text-sm" />
            </a>
          {:else if transfer.finalised?.Solana?.signature}
            <a
              href={getExplorerUrl(
                "sol",
                transfer.finalised.Solana.signature,
                "tx",
              )}
              target="_blank"
              rel="noopener noreferrer"
              class="text-lime/70 hover:text-lime transition-colors"
              title="View destination transaction"
              aria-label="View destination transaction"
            >
              <div class="i-mdi:link-variant text-sm" />
            </a>
          {:else if transfer.finalised?.EVMLog?.transaction_hash}
            <a
              href={getExplorerUrl(
                recipientChain,
                transfer.finalised.EVMLog.transaction_hash,
                "tx",
              )}
              target="_blank"
              rel="noopener noreferrer"
              class="text-lime/70 hover:text-lime transition-colors"
              title="View destination transaction"
              aria-label="View destination transaction"
            >
              <div class="i-mdi:link-variant text-sm" />
            </a>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>
