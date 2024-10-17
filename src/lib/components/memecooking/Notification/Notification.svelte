<script lang="ts">
  import Near from "$lib/assets/Near.svelte";
  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";
  import { MCTradeSubscribe } from "$lib/store/memebids";
  import { FixedNumber } from "$lib/util";

  let notification: {
    id: string;
    meme_id: number;
    amount: string;
    is_deposit: boolean;
    party: string;
    ticker: string;
    icon: string;
  } | null = null;

  let shake = false;

  MCTradeSubscribe(Symbol("notification"), (newMemeInfo) => {
    const amount = (
      BigInt(newMemeInfo.amount) + BigInt(newMemeInfo.fee)
    ).toString();
    notification = {
      id: newMemeInfo.receipt_id,
      meme_id: newMemeInfo.meme_id,
      amount,
      is_deposit: newMemeInfo.is_deposit,
      party: newMemeInfo.account_id,
      ticker: newMemeInfo.symbol,
      icon: `${import.meta.env.VITE_IPFS_GATEWAY}/${newMemeInfo.image}`,
    };

    // Trigger the shake animation
    shake = true;
    setTimeout(() => {
      shake = false;
    }, 500); // Duration of the shake animation
  });
</script>

{#if notification !== null}
  <section
    class="flex items-center {notification.is_deposit
      ? 'bg-shitzu-3'
      : 'bg-rose-3'} text-sm text-dark px-2 py-1 rounded {shake
      ? 'animate-shake-x animate-duration-500'
      : ''}"
  >
    <img src={SHITZU_POCKET} alt="shitzu pocket" class="size-6 mr-1" />
    <a
      href={`/profile/${notification.party}`}
      class="max-w-25 overflow-hidden whitespace-nowrap text-ellipsis mx-1 hover:font-bold"
    >
      {notification.party}
    </a>
    {notification.is_deposit ? "deposited" : "withdrew"}
    <Near className="size-6 ml-1" />
    {new FixedNumber(notification.amount, 24).format({
      maximumSignificantDigits: 4,
    })} for
    <a
      href={`/meme/${notification.meme_id}`}
      class="text-shitzu-7 flex items-center ml-1 hover:font-bold"
    >
      {notification.ticker}
      <img
        src={notification.icon}
        alt="icon"
        class="size-6 rounded-full ml-1"
      />
    </a>
  </section>
{/if}
