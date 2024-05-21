<script context="module" lang="ts">
  export async function showWalletSelector() {
    modalSize$.set(ModalSize.Medium);
    modal$.set(bind(WalletSelector, {}));
  }
</script>

<script lang="ts">
  import { bind } from "svelte-simple-modal";

  import { WalletSelector } from ".";

  import { modal$, modalSize$, ModalSize } from "$lib/layout";
  import { wallet } from "$lib/near";

  export let isTG: boolean;

  const iconUrl$ = wallet.iconUrl$;
  const accountId$ = wallet.accountId$;
</script>

<div class="login">
  {#await $iconUrl$ then iconUrl}
    {#if iconUrl}
      <a
        href="/account"
        class="border-2 border-lime hover:bg-lime/10 flex justify-center items-center decoration-none px-4 py-2 rounded-xl"
      >
        <img src={iconUrl} alt="wallet icon" class="w-4 h-4 mr-2" />
        {$accountId$}
      </a>
    {:else}
      <button
        on:click={() => {
          if (isTG) {
            wallet.loginViaHere();
          } else {
            showWalletSelector();
          }
        }}
        class="border-2 border-lime hover:bg-lime/10 px-4 py-2 rounded-xl"
      >
        Connect Wallet
      </button>
    {/if}
  {/await}
</div>
