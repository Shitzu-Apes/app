<script lang="ts">
  import { onMount } from "svelte";
  import { get } from "svelte/store";

  import Near from "$lib/assets/Near.svelte";
  import TokenInput from "$lib/components/TokenInput.svelte";
  import { nearBalance, refreshNearBalance } from "$lib/near";
  import { wallet } from "$lib/near/wallet";

  export let quickActionAmount = "5";
  let formattedBalance = "0";

  $: if ($nearBalance) {
    formattedBalance = $nearBalance.format();
  }

  onMount(() => {
    const accountId = get(wallet.accountId$);
    if (accountId) {
      refreshNearBalance(accountId);
    }
  });

  function setMaxAmount() {
    if ($nearBalance) {
      quickActionAmount = formattedBalance;
    }
  }

  $: if ($nearBalance && Number(quickActionAmount) > Number(formattedBalance)) {
    quickActionAmount = formattedBalance;
  }
</script>

<div class="ml-0 sm:ml-auto flex items-center gap-2">
  <div class="flex flex-col">
    <span class="text-sm text-white">Quick Buy/Deposit:</span>
    <button
      class="text-xs text-gray-400 cursor-pointer w-fit"
      on:click={setMaxAmount}
    >
      max: {formattedBalance} Ⓝ
    </button>
  </div>
  <div class="relative w-24">
    <TokenInput
      bind:value={quickActionAmount}
      decimals={24}
      class="w-full pl-7 pr-2 py-1 bg-transparent border border-gray-100 text-white rounded focus:border-shitzu-3 focus:outline-none"
      placeholder="5.00"
    />
    <Near
      className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-white text-gray-700 rounded-full"
    />
  </div>
</div>
