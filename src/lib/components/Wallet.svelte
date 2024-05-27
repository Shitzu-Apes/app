<script lang="ts">
  import { FixedNumber } from "@tarnadas/fixed-number";

  import { MessageBox } from "$lib/components";
  import DogshitUndistributedReward from "./DogshitUndistributedReward.svelte";

  export let accountId: string;

  let nearBalance: FixedNumber | undefined;

  fetchNearBalance();

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
<div class="flex gap-2 items-center">
  <span>Wallet balance:</span>
  <span>{nearBalance ? `${nearBalance.format()} NEAR` : "-"}</span>
  {#if nearBalance != null && nearBalance.toNumber() < 0.5}
    <MessageBox type="warning">
      Your Near balance is low! Please top up your Near balance to not run out
      of gas.
    </MessageBox>
  {/if}
</div>

<DogshitUndistributedReward />
