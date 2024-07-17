<script lang="ts">
  import { openBottomSheet } from "../BottomSheet/Container.svelte";

  import MEMECOOKING_LOGO from "$lib/assets/logo/memecooking.svg";
  import { showWalletSelector } from "$lib/auth";
  import HowItWorkSheet from "$lib/components/memecooking/BottomSheet/HowItWorkSheet.svelte";
  import Chef from "$lib/components/memecooking/Chef.svelte";
  import Notification from "$lib/components/memecooking/Notification/Notification.svelte";
  import { wallet } from "$lib/near";

  const { accountId$ } = wallet;
</script>

<nav class="py-2 px-2 w-full flex flex-wrap justify-between">
  <div class="flex gap-4 items-center">
    <a href="/board">
      <img src={MEMECOOKING_LOGO} class="size-8" alt="Shitzu face" />
    </a>
    <ul class="text-sm">
      <div class="flex gap-2">
        <li class="mr-2">
          <a href="https://twitter.com/memedotcooking"> [twitter]</a>
        </li>
        <li>
          <a href="https://t.me/memedotcookinsupports"> [support]</a>
        </li>
      </div>
      <div class="flex gap-2">
        <li>
          <a href="https://t.me/+wIFBaPQJmAcwYTc0"> [telegram]</a>
        </li>
        <li>
          <button
            on:click={() => {
              openBottomSheet(HowItWorkSheet);
            }}
          >
            [how it works]</button
          >
        </li>
      </div>
    </ul>
  </div>

  <div class="order-last sm:order-none mx-auto mt-3 sm:mt-0">
    <Notification />
  </div>

  {#if $accountId$}
    <a
      href="/profile/{$accountId$}"
      class="text-sm inline-flex items-center h-fit"
    >
      [
      <Chef account={$accountId$} class="mr-1 text-shitzu-4 w-fit" />
      ]
    </a>
  {:else}
    <button
      class="text-sm"
      on:click={wallet.isTG
        ? wallet.loginViaHere
        : () => showWalletSelector("shitzu")}
    >
      [connect]
    </button>
  {/if}
</nav>
