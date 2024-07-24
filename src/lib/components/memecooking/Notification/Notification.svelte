<script lang="ts">
  import Near from "$lib/assets/Near.svelte";
  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";
  import { MCsubscribe } from "$lib/store/memebids";
  import { FixedNumber } from "$lib/util";

  let notification: {
    id: string;
    amount: string;
    is_deposit: boolean;
    party: string;
    ticker: string;
    icon: string;
  } | null = null;

  let shake = false;

  // wait for actual type when integrate
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  MCsubscribe(Symbol("notification"), (newMemeInfo) => {
    notification = {
      id: newMemeInfo.receipt_id,
      amount: newMemeInfo.amount,
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
      : 'bg-memecooking-3'} text-sm text-dark px-2 py-1 rounded {shake
      ? 'animate-shake-x animate-duration-500'
      : ''}"
  >
    <img src={SHITZU_POCKET} alt="shitzu pocket" class="size-6 mr-1" />
    <span class="max-w-16 overflow-hidden text-ellipsis mx-1">
      {notification.party}
    </span>
    {notification.is_deposit ? "deposited" : "withdrawn"}
    <Near className="size-6 ml-1" />
    {new FixedNumber(notification.amount, 24).format({
      maximumSignificantDigits: 4,
    })} for
    {notification.ticker}
    <img src={notification.icon} alt="icon" class="size-6 rounded-full ml-1" />
  </section>
{/if}
