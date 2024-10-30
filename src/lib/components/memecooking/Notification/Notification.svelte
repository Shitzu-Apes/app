<script lang="ts">
  import { slide } from "svelte/transition";

  import Near from "$lib/assets/Near.svelte";
  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";
  import { MCTradeSubscribe } from "$lib/store/memebids";
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
