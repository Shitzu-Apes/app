<script lang="ts">
  import { MessageBox, Wallet } from "$lib/components";
  import { wallet } from "$lib/near";

  const accountId$ = wallet.accountId$;
</script>

<div class="page">
  <h2>Wallet</h2>
  {#if $accountId$}
    <Wallet accountId={$accountId$} />
  {:else}
    <MessageBox type="info">Please log in!</MessageBox>
  {/if}
</div>

<style lang="scss">
  h2 {
    font-size: 1.7rem;
    align-self: center;
  }

  .page {
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
  }
</style>
