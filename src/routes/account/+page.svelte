<script lang="ts">
  import { MessageBox, Wallet } from "$lib/components";
  import { wallet } from "$lib/near";

  const accountId$ = wallet.accountId$;
</script>

<div class="flex flex-col gap-4 items-start w-full">
  <div class="my-6">
    {#if $accountId$}
      <Wallet accountId={$accountId$} />
    {:else}
      <MessageBox type="info">Please log in!</MessageBox>
    {/if}
  </div>
</div>
