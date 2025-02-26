<script lang="ts" context="module">
  export type Notification = {
    id: string;
    meme_id: string;
    amount: string;
    decimals: number;
    is_deposit: boolean;
    is_mc: boolean;
    party: string;
    ticker: string;
    icon: string;
  };
</script>

<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { slide } from "svelte/transition";

  import type { Meme } from "$lib/api/client";
  import { queryClient } from "$lib/api/queries";
  import { memesQueryFactory } from "$lib/api/queries/memes";
  import Near from "$lib/assets/Near.svelte";
  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";
  import McIcon from "$lib/components/MCIcon.svelte";
  import { external_memes, EXTERNAL_MEMES } from "$lib/external_memes";
  import { MCTradeSubscribe, MCunsubscribe } from "$lib/store/MCWebSocket";
  import { EXTTradeSubscribe, EXTunsubscribe } from "$lib/store/externalTrades";
  import { FixedNumber } from "$lib/util";

  let notifications: Notification[] = [];

  $: {
    // save notifications to local storage
    if (notifications.length > 0) {
      localStorage.setItem("notifications", JSON.stringify(notifications));
    }
  }

  let symbol = Symbol("notification");
  let externalSymbol = Symbol("external");

  onMount(() => {
    console.log("[Notification] mounted");

    // load notifications from local storage
    const loadedNotifications = JSON.parse(
      localStorage.getItem("notifications") || "[]",
    );

    // make sure notifications are unique over id + amount
    const uniqueNotifications = new Set(
      loadedNotifications.map((n: Notification) => n.id + n.amount),
    );

    if (uniqueNotifications.size > 0) {
      notifications = Array.from(uniqueNotifications).map((id) =>
        loadedNotifications.find((n: Notification) => n.id + n.amount === id),
      );
    }

    MCTradeSubscribe(symbol, (newMemeInfo) => {
      if (newMemeInfo.amount == null || newMemeInfo.fee == null) return;
      const amount = (
        BigInt(newMemeInfo.amount) + BigInt(newMemeInfo.fee)
      ).toString();

      // Check if notification with this ID already exists
      if (
        notifications.some(
          (n) =>
            n.id + n.amount === newMemeInfo.receipt_id + newMemeInfo.amount,
        )
      )
        return;

      notifications = [
        {
          id: newMemeInfo.receipt_id,
          meme_id: newMemeInfo.meme_id.toString(),
          amount,
          decimals: 24,
          is_deposit: newMemeInfo.is_deposit ?? true,
          is_mc: true,
          party: newMemeInfo.account_id,
          ticker: newMemeInfo.symbol,
          icon: `${import.meta.env.VITE_IPFS_GATEWAY}/${newMemeInfo.image}`,
        },
        ...notifications.slice(0, 9),
      ];
    });

    EXTTradeSubscribe(externalSymbol, async (data) => {
      try {
        const balanceChanges = data.balance_changes;

        // Check if any of the tokens include the meme cooking contract or allowed tokens
        const relevantToken = Object.keys(balanceChanges).find(
          (token) =>
            token.includes("meme-cooking") ||
            EXTERNAL_MEMES.map((meme) => meme?.token_id).includes(token),
        );

        if (relevantToken) {
          const amount = balanceChanges[relevantToken];
          const isDeposit = !amount.startsWith("-");

          if (relevantToken.includes("meme-cooking")) {
            // Handle meme cooking tokens
            const memeId = parseInt(relevantToken.split("-")[1]);
            const memes = queryClient.getQueryData<Meme[]>(
              memesQueryFactory.memes.all().queryKey,
            );
            const memeInfo = memes?.find((m) => m.meme_id === memeId);
            if (!memeInfo) return;
            notifications = [
              {
                id: data.receipt_id,
                meme_id: memeInfo.meme_id.toString(),
                amount: amount.replace("-", ""),
                decimals: memeInfo.decimals,
                is_deposit: isDeposit,
                is_mc: false,
                party: data.trader,
                ticker: memeInfo.symbol,
                icon: `${import.meta.env.VITE_IPFS_GATEWAY}/${memeInfo.image}`,
              },
              ...notifications.slice(0, 9),
            ];
          } else {
            // Handle allowed tokens
            const tokenInfo = external_memes[relevantToken];
            notifications = [
              {
                id: data.receipt_id,
                meme_id: relevantToken,
                amount: amount.replace("-", ""),
                decimals: tokenInfo.decimals,
                is_deposit: isDeposit,
                is_mc: false,
                party: data.trader,
                ticker: tokenInfo.symbol,
                icon: tokenInfo.image || SHITZU_POCKET, // Fallback to SHITZU_POCKET if no icon
              },
              ...notifications.slice(0, 9),
            ];
          }
        }
      } catch (error) {
        console.error(
          "[Notification] Error processing WebSocket message:",
          error,
        );
      }
    });
  });

  onDestroy(() => {
    MCunsubscribe(symbol);
    EXTunsubscribe(externalSymbol);
  });
</script>

<div class="flex gap-2 overflow-x-auto scrollbar-none py-2 pl-[2px]">
  {#each notifications as notification (notification.id + notification.amount)}
    <a
      href={`/meme/${notification.meme_id}`}
      class="flex-shrink-0 w-40 h-20 rounded hover:ring-2 overflow-hidden {notification.is_deposit
        ? 'bg-shitzu-4/50 hover:ring-shitzu-3'
        : 'bg-rose-4/50 hover:ring-rose-3'}"
      in:slide={{ axis: "x" }}
    >
      <div class="flex h-full">
        <!-- Image Section -->
        <div class="relative w-1/3 h-full bg-white">
          <McIcon
            meme={{ image: notification.icon, name: notification.ticker }}
            class="w-full h-full object-cover"
          />
        </div>

        <div class="w-2/3 p-2 flex flex-col justify-between">
          <!-- Amount -->
          <div class="flex items-center gap-1 text-xs">
            {#if notification.is_mc}
              <span class="w-4 flex justify-center flex-shrink-0">
                <Near className="size-3 bg-white text-black rounded-full" />
              </span>
              <span class="flex-shrink-1 font-medium">
                {new FixedNumber(
                  notification.amount,
                  notification.decimals,
                ).format({
                  maximumSignificantDigits: 3,
                  maximumFractionDigits: 1,
                  notation: "compact",
                  compactDisplay: "short",
                })}
              </span>
            {:else}
              <span class="w-4 flex justify-center flex-shrink-0">
                <img
                  class="size-3 bg-white text-black rounded-full"
                  src={notification.icon}
                  alt={notification.ticker}
                />
              </span>
              <span class="flex-shrink-1 font-medium">
                {new FixedNumber(
                  notification.amount,
                  notification.decimals,
                ).format({
                  maximumSignificantDigits: 3,
                  maximumFractionDigits: 1,
                  notation: "compact",
                  compactDisplay: "short",
                })}
              </span>
            {/if}
          </div>

          <!-- Ticker -->
          <div class="flex items-center gap-1 text-xs">
            <span class="w-4 flex justify-center flex-shrink-0">$</span>
            <span class="flex-shrink-1 font-medium text-shitzu-4 truncate">
              {notification.ticker}
            </span>
          </div>

          <!-- Party -->
          <div class="flex items-center gap-1 text-xs">
            <span class="w-4 flex justify-center flex-shrink-0">
              <img src={SHITZU_POCKET} alt="U" class="size-3" />
            </span>
            <span class="flex-shrink-1 font-medium truncate">
              {notification.party}
            </span>
          </div>
        </div>
      </div>
    </a>
  {/each}
</div>
