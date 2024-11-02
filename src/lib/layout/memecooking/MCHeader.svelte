<script lang="ts">
  import { createDropdownMenu, melt } from "@melt-ui/svelte";

  import { openBottomSheet } from "../BottomSheet/Container.svelte";

  import MEMECOOKING_LOGO from "$lib/assets/logo/meme-cooking.webp";
  import SHITZU_LOGO from "$lib/assets/logo/shitzu.webp";
  import { showWalletSelector } from "$lib/auth";
  import BridgeSheet from "$lib/components/memecooking/BottomSheet/BridgeSheet.svelte";
  import HowItWorkSheet from "$lib/components/memecooking/BottomSheet/HowItWorkSheet.svelte";
  import Chef from "$lib/components/memecooking/Chef.svelte";
  import MemeCreationNotification from "$lib/components/memecooking/Notification/MemeCreationNotification.svelte";
  import Notification from "$lib/components/memecooking/Notification/Notification.svelte";
  import { wallet } from "$lib/near";

  const { accountId$, iconUrl$, walletName$ } = wallet;

  const {
    elements: { trigger, item, menu },
    states: { open },
  } = createDropdownMenu();
</script>

<nav class="w-full px-2">
  <div class="">
    <div class="flex justify-between h-fit py-2 items-center">
      <!-- Left section: Logo and primary navigation -->
      <div class="flex items-center gap-4">
        <!-- Logo -->
        <div class="flex items-center gap-4">
          <a href="/board" class="flex items-center">
            <img
              src={MEMECOOKING_LOGO}
              class="h-8 w-auto"
              alt="Meme Cooking Logo"
            />
          </a>
          <div class="flex flex-col text-xs text-gray-400">
            <div class="flex items-center gap-1">
              made with <div class="i-mdi:heart text-rose-500" />
            </div>
            <div class="flex items-center gap-1">
              by <img src={SHITZU_LOGO} class="h-4 w-4" alt="Shitzu Logo" /> shitzu
            </div>
          </div>
        </div>

        <!-- Primary Navigation -->
        <div class="relative">
          <button
            use:melt={$trigger}
            class="text-shitzu-300 rounded-full text-sm flex items-center gap-1 p-1"
          >
            <div class="i-mdi:view-grid-outline text-xl" />
          </button>

          <div
            use:melt={$menu}
            class="grid grid-cols-3 gap-2 absolute top-full left-0 mt-2 w-64 rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 z-30 p-2"
          >
            <button
              use:melt={$item}
              on:click={() => {
                openBottomSheet(BridgeSheet);
                $open = false;
              }}
              class="flex flex-col items-center justify-center p-2 text-gray-300 hover:text-white transition-colors"
            >
              <div
                class="size-6 mb-1 rounded flex items-center justify-center bg-[#84cc16]"
              >
                <div class="i-mdi:bridge text-2xl text-black size-4" />
              </div>
              <span class="text-[10px] text-center whitespace-nowrap"
                >Bridge</span
              >
            </button>

            <button
              use:melt={$item}
              on:click={() => {
                openBottomSheet(HowItWorkSheet);
                $open = false;
              }}
              class="flex flex-col items-center justify-center p-2 text-gray-300 hover:text-white transition-colors"
            >
              <div
                class="size-6 mb-1 rounded flex items-center justify-center bg-[#84cc16]"
              >
                <div
                  class="i-mdi:help-circle-outline text-2xl text-black size-4"
                />
              </div>
              <span class="text-[10px] text-center whitespace-nowrap"
                >How it Works</span
              >
            </button>

            <a
              use:melt={$item}
              href="https://docs.meme.cooking"
              target="_blank"
              rel="noopener noreferrer"
              class="flex flex-col items-center justify-center p-2 text-gray-300 hover:text-white transition-colors"
            >
              <div
                class="size-6 mb-1 rounded flex items-center justify-center bg-[#84cc16]"
              >
                <div class="i-mdi:document text-2xl text-black size-4" />
              </div>
              <span class="text-[10px] text-center whitespace-nowrap">Docs</span
              >
            </a>

            <a
              use:melt={$item}
              href="https://x.com/memedotcooking"
              target="_blank"
              rel="noopener noreferrer"
              class="flex flex-col items-center justify-center p-2 text-gray-300 hover:text-white transition-colors"
            >
              <div
                class="size-6 mb-1 rounded flex items-center justify-center bg-black"
              >
                <div class="i-mdi:twitter text-2xl text-white size-4" />
              </div>
              <span class="text-[10px] text-center whitespace-nowrap"
                >Twitter</span
              >
            </a>

            <a
              use:melt={$item}
              href="https://t.me/+wIFBaPQJmAcwYTc0"
              target="_blank"
              rel="noopener noreferrer"
              class="flex flex-col items-center justify-center p-2 text-gray-300 hover:text-white transition-colors"
            >
              <div
                class="size-6 mb-1 rounded flex items-center justify-center bg-[#26A5E4]"
              >
                <div class="i-mdi:telegram text-2xl text-white size-4" />
              </div>
              <span class="text-[10px] text-center whitespace-nowrap"
                >Telegram</span
              >
            </a>

            <a
              use:melt={$item}
              href="https://app.shitzuapes.xyz"
              target="_blank"
              rel="noopener noreferrer"
              class="flex flex-col items-center justify-center p-2 text-gray-300 hover:text-white transition-colors"
            >
              <img src={SHITZU_LOGO} class="size-6 mb-1" alt="Shitzu Logo" />
              <span class="text-[10px] text-center whitespace-nowrap"
                >Shitzu</span
              >
            </a>
          </div>
        </div>
      </div>

      <!-- Right section: Account -->
      <div class="flex items-center gap-4">
        <!-- Account Section -->
        {#if $accountId$}
          <div class="flex items-center gap-2">
            {#await Promise.all( [$iconUrl$, $walletName$], ) then [iconUrl, walletName]}
              <div
                class="flex items-center gap-2 px-3 py-2 rounded-full bg-gray-800"
              >
                <Chef
                  account={$accountId$}
                  class="text-shitzu-4 text-sm"
                  asLink
                >
                  <img
                    src={iconUrl}
                    alt={walletName}
                    class={`size-5 rounded-full ${(walletName ?? "").replaceAll(" ", "-").toLowerCase()}`}
                  />
                </Chef>
                <button
                  class="text-gray-300 hover:text-white text-sm"
                  on:click={wallet.signOut}
                >
                  <div class="i-mdi:logout text-xl" />
                </button>
              </div>
            {/await}
          </div>
        {:else}
          <button
            class="px-4 py-2 rounded-full bg-shitzu-4 text-black font-medium hover:bg-shitzu-5 transition-colors duration-200"
            on:click={wallet.isTG
              ? wallet.loginViaHere
              : () => showWalletSelector("shitzu")}
          >
            Connect Wallet
          </button>
        {/if}
      </div>
    </div>
  </div>
</nav>

<div
  class="flex items-center flex-wrap justify-center w-full bg-gray-800 rounded mb-2 overflow-hidden"
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
