<script lang="ts">
  import McDeposit from "./MCDeposit.svelte";
  import McRef from "./MCRef/index.svelte";

  import { showWalletSelector } from "$lib/auth/showWalletSelector";
  import type { Meme } from "$lib/models/memecooking";
  import { nearWallet } from "$lib/near";

  export let meme: Meme;

  const { accountId$ } = nearWallet;

  $: isDeposit = !meme.pool_id;
</script>

{#if $accountId$}
  {#if isDeposit}
    <McDeposit {meme} accountId={$accountId$} />
  {:else}
    <McRef {meme} />
  {/if}
{:else}
  <div class="flex flex-col gap-4">
    <button
      class="px-4 py-1 rounded-lg text-sm bg-shitzu-4 text-black font-medium hover:bg-shitzu-5 transition-colors duration-200"
      on:click={() => showWalletSelector("shitzu")}
    >
      Connect Wallet
    </button>
  </div>
{/if}
