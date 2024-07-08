<script lang="ts">
  import { createTabs, melt } from "@melt-ui/svelte";

  import TokenInput from "$lib/components/TokenInput.svelte";
  import { MemeCooking, wallet } from "$lib/near";
  import { FixedNumber } from "$lib/util";

  const tabs = [
    { id: "stake", label: "stake" },
    { id: "unstake", label: "unstake" },
  ];

  const { accountId$ } = wallet;

  let input: TokenInput;
  $: input$ = input?.u128$;

  const {
    elements: { root, list, trigger },
    states: { value },
  } = createTabs({
    defaultValue: "stake",
  });

  async function action() {
    if (!$input$ || !$accountId$) return;
    if ($value === "stake") {
      // Check storage balance before staking
      const [storageBalance, { min: minStorageBalance }] = await Promise.all([
        MemeCooking.storageBalanceOf($accountId$),
        MemeCooking.storageBalanceBounds(),
      ]);

      let needStorageDeposit = null;
      if (
        !storageBalance ||
        new FixedNumber(storageBalance, 24).toBigInt() <
          new FixedNumber(minStorageBalance, 24).toBigInt()
      ) {
        needStorageDeposit = {
          depositAmount: minStorageBalance,
        };
      }

      MemeCooking.deposit(
        wallet,
        { amount: $input$.toU128(), memeId: 1 },
        {},
        needStorageDeposit,
      );
    } else {
      console.log("unstake");
    }
  }
</script>

<div
  use:melt={$root}
  class="w-full h-full flex flex-col justify-between items-center"
>
  <div use:melt={$list} class="flex justify-between items-stretch gap-6 w-full">
    {#each tabs as tab}
      <button
        use:melt={$trigger(tab.id)}
        class="w-1/2 py-1 {tab.id === $value
          ? 'text-shitzu-4 border-current'
          : 'text-gray-4 border-transparent'} border-b-4 font-600"
      >
        {tab.label}
      </button>
    {/each}
  </div>
  <TokenInput
    class="bg-transparent border border-shitzu-4 rounded w-full py-2 px-2"
    decimals={24}
    bind:this={input}
  />
  <button on:click={action} class="bg-shitzu-6 w-full py-2 rounded text-black"
    >{$value}</button
  >
</div>
