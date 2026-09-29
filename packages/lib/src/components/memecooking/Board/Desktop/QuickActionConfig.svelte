<script lang="ts">
  import { onMount } from "svelte";
  import { get } from "svelte/store";

  import Near from "$lib/assets/Near.svelte";
  import TokenInput from "$lib/components/TokenInput.svelte";
  import { nearBalance, refreshNearBalance } from "$lib/near";
  import { nearWallet } from "$lib/near/wallet";

  export let quickActionAmount = "5";
  let formattedBalance = "0";

  $: if ($nearBalance) {
    formattedBalance = $nearBalance.format();
  }

  onMount(() => {
    const accountId = get(nearWallet.accountId$);
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

<div class="flex items-center gap-2">
  <div class="flex flex-col">
    <span class="text-sm text-shitzu-1">Quick Buy:</span>
    <button
      class="text-xs text-shitzu-3 hover:text-shitzu-4 cursor-pointer w-fit transition-colors"
      on:click={setMaxAmount}
    >
      max: {formattedBalance} Ⓝ
    </button>
  </div>
  <div class="relative w-24">
    <TokenInput
      bind:value={quickActionAmount}
      decimals={24}
      class="w-full pl-7 pr-2 py-1 bg-gray-800/50 border border-gray-700 text-shitzu-1 rounded-lg focus:border-shitzu-4 focus:outline-none transition-colors"
      placeholder="5.00"
    />
    <Near
      className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-white text-gray-800 rounded-full"
    />
  </div>
</div>
