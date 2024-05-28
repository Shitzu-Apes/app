<script lang="ts">
  import { FixedNumber } from "@tarnadas/fixed-number";

  import Near from "$lib/assets/Near.svelte";
  import ShitzuFace from "$lib/assets/logo/shitzu.webp";
  import { MessageBox } from "$lib/components";
  import { refreshShitzuBalance, shitzuBalance } from "$lib/store";

  export let accountId: string;

  let nearBalance: FixedNumber | undefined;

  fetchNearBalance();
  $: refreshShitzuBalance(accountId);

  async function fetchNearBalance() {
    const res = await fetch(import.meta.env.VITE_NODE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "dontcare",
        method: "query",
        params: {
          request_type: "view_account",
          finality: "final",
          account_id: accountId,
        },
      }),
    });
    const json = (await res.json()) as {
      result: { amount: string; locked: string };
    };
    if (!json.result) return;
    nearBalance = new FixedNumber(json.result.amount, 24).sub(
      new FixedNumber(json.result.locked, 24),
    );
  }
</script>

<div
  class="flex flex-col gap-2 justify-center items-center rounded-xl p-2 w-full"
>
  <object
    title="profile"
    data="https://stackoverflow.com/does-not-exist.png"
    type="image/png"
  >
    <img
      src="https://i.near.social/magic/thumbnail/https://near.social/magic/img/account/{accountId}"
      alt="profile"
      class="rounded-full size-20"
    />
  </object>
  <h2 class="not-prose text-2xl font-bold">{accountId}</h2>
</div>
<div class="flex flex-col justify-center gap-2 items-center mt-6">
  {#if nearBalance != null}
    <div class="w-full flex justify-evenly">
      <span class="flex items-center gap-1">
        <Near className="size-6" />
        {nearBalance.format()}
      </span>
      <!-- Vertical Divider -->
      <div class="border-l border-gray-4 h-6" />
      <span>
        {#await $shitzuBalance}
          <div class="i-svg-spinners:6-dots-rotate size-6 bg-gray-8" />
        {:then balance}
          <span class="flex items-center gap-1">
            <img src={ShitzuFace} alt="SHITZU" class="w-6 h-6" />
            {balance.format()}
          </span>
        {/await}
      </span>
    </div>
  {:else}
    <span>-</span>
  {/if}
  {#if nearBalance != null && nearBalance.toNumber() < 0.5}
    <MessageBox type="warning">
      Your Near balance is low! Please top up your Near balance to not run out
      of gas.
    </MessageBox>
  {/if}
</div>
