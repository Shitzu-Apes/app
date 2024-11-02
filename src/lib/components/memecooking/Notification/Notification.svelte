<script lang="ts">
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";

  import tokens from "../../../../tokens.json";

  import Near from "$lib/assets/Near.svelte";
  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";
  import { getToken } from "$lib/store";
  import { EXTTradeSubscribe } from "$lib/store/externalTrades";
  import { MCTradeSubscribe, memebids$ } from "$lib/store/memebids";
  import { FixedNumber } from "$lib/util";

  const ALLOWED_TOKENS = tokens.map(({ token_id }) => token_id);

  let notifications: {
    id: string;
    meme_id: string;
    amount: string;
    decimals: number;
    is_deposit: boolean;
    is_mc: boolean;
    party: string;
    ticker: string;
    icon: string;
  }[] = [];

  MCTradeSubscribe(Symbol("notification"), (newMemeInfo) => {
    const amount = (
      BigInt(newMemeInfo.amount) + BigInt(newMemeInfo.fee)
    ).toString();
    notifications = [
      {
        id: newMemeInfo.receipt_id,
        meme_id: newMemeInfo.meme_id.toString(),
        amount,
        decimals: 24,
        is_deposit: newMemeInfo.is_deposit,
        is_mc: true,
        party: newMemeInfo.account_id,
        ticker: newMemeInfo.symbol,
        icon: `${import.meta.env.VITE_IPFS_GATEWAY}/${newMemeInfo.image}`,
      },
      ...notifications.slice(0, 9),
    ];
  });

  onMount(() => {
    console.log("[Notification] mounted");

    EXTTradeSubscribe(Symbol("notification"), async (data) => {
      try {
        const balanceChanges = data.balance_changes;

        // Check if any of the tokens include the meme cooking contract or allowed tokens
        const relevantToken = Object.keys(balanceChanges).find(
          (token) =>
            token.includes("meme-cooking") || ALLOWED_TOKENS.includes(token),
        );

        if (relevantToken) {
          const amount = balanceChanges[relevantToken];
          const isDeposit = !amount.startsWith("-");

          if (relevantToken.includes("meme-cooking")) {
            // Handle meme cooking tokens
            const memeId = parseInt(relevantToken.split("-")[1]);
            const memeInfo = $memebids$.find((meme) => meme.meme_id === memeId);
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
            const tokenInfo = await getToken(relevantToken);
            notifications = [
              {
                id: data.receipt_id,
                meme_id: relevantToken,
                amount: amount.replace("-", ""),
                decimals: tokenInfo.decimal,
                is_deposit: isDeposit,
                is_mc: false,
                party: data.trader,
                ticker: tokenInfo.symbol,
                icon: tokenInfo.icon || SHITZU_POCKET, // Fallback to SHITZU_POCKET if no icon
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
</script>

<div class="flex gap-2 overflow-x-auto scrollbar-none p-2">
  {#each notifications as notification (notification.id)}
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
          <img
            src={notification.icon}
            alt={notification.ticker}
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
