<script lang="ts">
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";

  import Near from "$lib/assets/Near.svelte";
  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";
  import { MCTradeSubscribe, memebids$ } from "$lib/store/memebids";
  import { FixedNumber } from "$lib/util";

  let notifications: {
    id: string;
    meme_id: number;
    amount: string;
    is_deposit: boolean;
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
        meme_id: newMemeInfo.meme_id,
        amount,
        is_deposit: newMemeInfo.is_deposit,
        party: newMemeInfo.account_id,
        ticker: newMemeInfo.symbol,
        icon: `${import.meta.env.VITE_IPFS_GATEWAY}/${newMemeInfo.image}`,
      },
      ...notifications.slice(0, 9),
    ];
  });

  onMount(() => {
    console.log("[Notification] mounted");
    const ws = new WebSocket("wss://ws-events.intear.tech/events/trade_swap");

    ws.onopen = () => {
      console.log("[Notification] WebSocket connected");
      ws.send("{}");
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        const balanceChanges = data.balance_changes;

        // Check if any of the tokens include the meme cooking contract
        const memeCookingToken = Object.keys(balanceChanges).find((token) =>
          token.includes("meme-cooking"),
        );

        if (memeCookingToken) {
          const amount = balanceChanges[memeCookingToken];
          const isDeposit = !amount.startsWith("-");
          // "gnuff-283.meme-cooking.near" -> 283
          const memeId = parseInt(memeCookingToken.split("-")[1]);
          console.log("[Notification] memeId", memeId);
          const memeInfo = (await $memebids$).find(
            (meme) => meme.meme_id === memeId,
          );
          console.log("[Notification] memeInfo", memeInfo);

          if (!memeInfo) return;
          notifications = [
            {
              id: data.receipt_id,
              meme_id: memeInfo.meme_id,
              amount: amount.replace("-", ""),
              is_deposit: isDeposit,
              party: data.trader,
              ticker: memeInfo.symbol,
              icon: `${import.meta.env.VITE_IPFS_GATEWAY}/${memeInfo.image}`,
            },
            ...notifications.slice(0, 9),
          ];
        }
      } catch (error) {
        console.error(
          "[Notification] Error processing WebSocket message:",
          error,
        );
      }
    };

    ws.onerror = (error) => {
      console.error("[Notification] WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("[Notification] WebSocket closed");
    };

    return () => {
      ws.close();
    };
  });
</script>

<div class="flex gap-2 overflow-x-auto scrollbar-none p-2">
  {#each notifications as notification (notification.id)}
    <a
      href={`/meme/${notification.meme_id}`}
      class="flex-shrink-0 w-40 h-20 rounded hover:ring-2 {notification.is_deposit
        ? 'bg-shitzu-4/50 hover:ring-shitzu-3'
        : 'bg-rose-4/50 hover:ring-rose-3'} animate-slide-in-from-left animate-duration-300"
      in:slide={{ axis: "x", delay: 100 }}
    >
      <div class="flex h-full">
        <!-- Image Section -->
        <div class="relative w-1/3 h-full bg-white">
          <img
            src={notification.icon}
            alt={notification.ticker}
            class="w-full h-full object-contain"
          />
        </div>

        <div class="w-2/3 p-2 flex flex-col justify-between">
          <!-- Amount -->
          <div class="flex items-center gap-1 text-xs">
            <span class="w-4 flex justify-center flex-shrink-0">
              <Near className="size-3 bg-white text-black rounded-full" />
            </span>
            <span class="flex-shrink-1 font-medium">
              {new FixedNumber(notification.amount, 24).format({
                maximumSignificantDigits: 3,
                notation: "compact",
              })}
            </span>
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
