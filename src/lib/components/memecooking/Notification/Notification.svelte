<script lang="ts">
  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";
  import { FixedNumber } from "$lib/util";

  const notification = {
    id: "x129fj2o",
    amount: "100000000000000000000000",
    is_deposit: true,
    party: "root.near",
    ticker: "drrrr",
    icon: "https://picsum.photos/id/237/200/200",
  };
</script>

<section class="flex items-center bg-shitzu-3 text-dark px-2 rounded-lg">
  <img src={SHITZU_POCKET} alt="shitzu pocket" class="size-6 mr-1" />
  {notification.party}
  {notification.is_deposit ? "deposited" : "withdrawn"}
  {new FixedNumber(notification.amount, 24).format()}
  {notification.ticker}
  <img src={notification.icon} alt="icon" class="size-6 rounded-full ml-1" />
</section>
