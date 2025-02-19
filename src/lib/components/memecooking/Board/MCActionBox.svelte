<script lang="ts">
  import McDeposit from "./MCDeposit.svelte";
  import McRef from "./MCRef/index.svelte";

  import type { Meme } from "$lib/models/memecooking";
  import { wallet } from "$lib/near";

  export let meme: Meme;

  const { accountId$ } = wallet;

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
    <div class="text-gray-400 text-sm">
      Connect your wallet to deposit or refer and earn fees
    </div>
  </div>
{/if}
