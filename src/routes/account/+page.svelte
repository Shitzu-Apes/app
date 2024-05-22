<script lang="ts">
  import { MessageBox, Wallet } from "$lib/components";
  import { wallet } from "$lib/near";

  const accountId$ = wallet.accountId$;
</script>

<div class="flex flex-col gap-4">
  <h2 class="font-size-7 self-center">Wallet</h2>
  {#if $accountId$}
    <Wallet accountId={$accountId$} />
  {:else}
    <MessageBox type="info">Please log in!</MessageBox>
  {/if}
</div>
