<script lang="ts">
  import { openBottomSheet } from "../BottomSheet/Container.svelte";

  import MEMECOOKING_LOGO from "$lib/assets/logo/meme-cooking.webp";
  import { showWalletSelector } from "$lib/auth";
  import BridgeSheet from "$lib/components/memecooking/BottomSheet/BridgeSheet.svelte";
  import HowItWorkSheet from "$lib/components/memecooking/BottomSheet/HowItWorkSheet.svelte";
  import Chef from "$lib/components/memecooking/Chef.svelte";
  import MemeCreationNotification from "$lib/components/memecooking/Notification/MemeCreationNotification.svelte";
  import Notification from "$lib/components/memecooking/Notification/Notification.svelte";
  import { wallet } from "$lib/near";

  const { accountId$, iconUrl$, walletName$ } = wallet;
</script>

<nav class="py-2 px-2 w-full flex flex-wrap justify-between">
  <div class="flex gap-4 items-center">
    <a href="/board">
      <img src={MEMECOOKING_LOGO} class="size-8" alt="Shitzu face" />
    </a>
    <ul class="text-sm">
      <div class="flex gap-2">
        <li class="mr-2">
          <a
            href="https://x.com/memedotcooking"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:font-bold hover:underline"
          >
            [𝕏]
          </a>
        </li>
        <li class="mr-2">
          <a
            href="https://docs.meme.cooking"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:font-bold hover:underline"
          >
            [docs]
          </a>
        </li>
        <li>
          <button
            on:click={() => {
              openBottomSheet(BridgeSheet);
            }}
            class="hover:font-bold"
          >
            [bridge]
          </button>
        </li>
      </div>
      <div class="flex gap-2">
        <li>
          <a
            href="https://t.me/+wIFBaPQJmAcwYTc0"
            target="_blank"
            rel="noopener noreferrer"
            class="hover:font-bold hover:underline"
          >
            [telegram]
          </a>
        </li>
        <li>
          <button
            on:click={() => {
              openBottomSheet(HowItWorkSheet);
            }}
            class="hover:font-bold"
          >
            [how it works]
          </button>
        </li>
      </div>
    </ul>
  </div>

  {#if $accountId$}
    <div class="flex flex-col items-end flex-1 sm:flex-none">
      <div class="text-sm inline-flex items-center h-fit">
        {#await Promise.all( [$iconUrl$, $walletName$], ) then [iconUrl, walletName]}
          [
          <Chef account={$accountId$} class="mr-1 text-shitzu-4 w-fit" asLink>
            <img
              src={iconUrl}
              alt={walletName}
              class={`size-4 object-contain ${(walletName ?? "").replaceAll(" ", "-").toLowerCase()}`}
            />
          </Chef>
          ]
        {/await}
      </div>
      <button class="text-xs w-fit hover:font-bold" on:click={wallet.signOut}
        >[logout]</button
      >
    </div>
  {:else}
    <button
      class="text-sm flex-1 sm:flex-none flex items-center justify-end"
      on:click={wallet.isTG
        ? wallet.loginViaHere
        : () => showWalletSelector("shitzu")}
    >
      [connect]
    </button>
  {/if}
</nav>

<div
  class="flex items-center flex-wrap justify-center w-full bg-gray-800 rounded my-2 overflow-hidden"
>
  <div class="flex-1 overflow-x-hidden pl-2">
    <Notification />
  </div>
  <div class="w-px h-22 bg-white mr-3 my-2"></div>
  <div class="flex-shrink-0 min-w-40 min-h-20 mr-2">
    <MemeCreationNotification />
  </div>
  <a
    href="/create"
    class="w-10 h-26 flex items-center justify-center bg-memecooking-500 text-black"
  >
    <div
      class="i-mdi:plus size-8 text-black animated animated-flash animated-infinite animated-duration-1000 hover:animate-none"
    />
  </a>
</div>
