<script lang="ts">
  import { MessageBox, Wallet } from "$lib/components";
  import DogshitUndistributedReward from "$lib/components/DogshitUndistributedReward.svelte";
  import RefBanner from "$lib/components/RefBanner.svelte";
  import { wallet } from "$lib/near";

  const accountId$ = wallet.accountId$;
</script>

<div class="flex flex-col gap-4 items-start w-full">
  <div class="my-6 w-full">
    {#if $accountId$}
      <Wallet accountId={$accountId$} />
    {:else}
      <MessageBox type="info">Please log in!</MessageBox>
    {/if}
  </div>

  <RefBanner />

  <DogshitUndistributedReward />
</div>
