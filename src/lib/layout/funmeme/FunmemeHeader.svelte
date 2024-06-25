<script lang="ts">
  import { openBottomSheet } from "../BottomSheet/Container.svelte";

  import FUNMEME_LOGO from "$lib/assets/logo/funmeme.svg";
  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";
  import { showWalletSelector } from "$lib/auth";
  import HowItWorkSheet from "$lib/components/funmeme/BottomSheet/HowItWorkSheet.svelte";
  import { wallet } from "$lib/near";

  const { accountId$ } = wallet;
</script>

<nav class="py-2 px-2 w-full flex justify-between">
  <div class="flex gap-4 items-center">
    <a href="/board">
      <img src={FUNMEME_LOGO} class="size-8" alt="Shitzu face" />
    </a>
    <ul class="text-sm">
      <div class="flex gap-2">
        <li class="mr-2">
          <a href="https://twitter.com/fundotmeme"> [twitter]</a>
        </li>
        <li>
          <a href="https://github.com/"> [support]</a>
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

  {#if $accountId$}
    <a href="/account" class="text-sm inline-flex items-center h-fit">
      [
      <img
        src={SHITZU_POCKET}
        alt="shitzu pocket"
        class="size-6 mr-1 text-shitzu-4"
      />
      <span class="max-w-20 overflow-hidden text-ellipsis">
        {$accountId$}
      </span>]
    </a>
  {:else}
    <button
      class="text-sm"
      on:click={wallet.isTG
        ? wallet.loginViaHere
        : () => showWalletSelector("funmeme")}
    >
      [connect]
    </button>
  {/if}
</nav>
