<script context="module" lang="ts">
  export async function showWalletSelector() {
    modalSize$.set(ModalSize.Medium);
    modal$.set(bind(WalletSelector, {}));
  }
</script>

<script lang="ts">
  import Button from "@smui/button";
  import type { Writable } from "svelte/store";
  import { bind } from "svelte-simple-modal";

  import { WalletSelector } from ".";

  import { Near } from "$lib/assets";
  import { modal$, modalSize$, ModalSize } from "$lib/layout";
  import { wallet } from "$lib/near";

  export let showAccountMenu$: Writable<boolean>;

  const iconUrl$ = wallet.iconUrl$;
</script>

<div class="login">
  <Button
    variant="outlined"
    on:click={() => {
      $showAccountMenu$ = !$showAccountMenu$;
    }}
  >
    {#await $iconUrl$ then iconUrl}
      {#if iconUrl}
        <img
          src={iconUrl}
          alt="wallet icon"
          style="max-height: 100%; padding: 0.3rem;"
        />
      {:else}
        <Near style="max-height: 100%; padding: 0.3rem;" />
      {/if}
    {/await}
  </Button>
</div>

<style>
  .login {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    flex-wrap: wrap;
    justify-content: end;
  }
</style>
