<script lang="ts">
  import { FixedNumber } from "@tarnadas/fixed-number";

  import { MessageBox } from "$lib/components";

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

<div class="section-field">
  <span>Connected account:</span>
  <span>{accountId}</span>
</div>
<div class="section-field">
  <span>Near balance:</span>
  <span>{nearBalance ? nearBalance.format() : "-"}</span>
  {#if nearBalance != null && nearBalance.toNumber() < 0.5}
    <MessageBox type="warning">
      Your Near balance is low! Please top up your Near balance to not run out
      of gas.
    </MessageBox>
  {/if}
</div>

<style lang="scss">
</style>
