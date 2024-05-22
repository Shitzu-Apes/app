<script context="module" lang="ts">
  export async function showWalletSelector() {
    modalSize$.set(ModalSize.Medium);
    modal$.set(bind(WalletSelector, {}));
  }
</script>

<script lang="ts">
  import { createDropdownMenu, melt } from "@melt-ui/svelte";
  import { bind } from "svelte-simple-modal";

  import { WalletSelector } from ".";

  import { modal$, modalSize$, ModalSize } from "$lib/layout";
  import { wallet } from "$lib/near";

  const iconUrl$ = wallet.iconUrl$;
  const accountId$ = wallet.accountId$;

  const {
    elements: { menu, item, trigger },
  } = createDropdownMenu();
</script>

<div class="login">
  {#await $iconUrl$ then iconUrl}
    {#if $accountId$ && iconUrl}
      <button
        use:melt={$trigger}
        class="border-2 border-lime hover:bg-lime/15 flex justify-center items-center decoration-none px-4 py-2 rounded-xl"
      >
        <img src={iconUrl} alt="wallet icon" class="w-4 h-4 mr-2" />
        {$accountId$}
      </button>
    {:else}
      <button
        on:click={() => {
          if (wallet.isTG) {
            wallet.loginViaHere();
          } else {
            showWalletSelector();
          }
        }}
        class="border-2 border-lime hover:bg-lime/15 px-4 py-2 rounded-xl"
      >
        Connect Wallet
      </button>
    {/if}
  {/await}

  <div
    use:melt={$menu}
    class="flex flex-col gap-2 bg-black text-white border-2 border-lime px-4 py-2 rounded-xl"
  >
    <a use:melt={$item} href="/account" class="hover:bg-lime/15 rounded-xl p-2">
      Show account
    </a>
    <div
      use:melt={$item}
      on:m-click={() => {
        wallet.signOut();
      }}
      class="cursor-pointer hover:bg-lime/15 rounded-xl p-2"
    >
      Logout
    </div>
  </div>
</div>
