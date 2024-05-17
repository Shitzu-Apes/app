<script lang="ts">
  import Button from "@smui/button";
  import { FixedNumber } from "@tarnadas/fixed-number";
  import { writable } from "svelte/store";
  import { bind } from "svelte-simple-modal";

  import type { PageData } from "./$types";

  import { showWalletSelector } from "$lib/auth";
  import { MessageBox, Stake } from "$lib/components";
  import { ModalSize, modal$, modalSize$ } from "$lib/layout";
  import {
    validatorContract$,
    wallet,
    type ValidatorContract,
  } from "$lib/near";

  export let data: PageData;

  const nearBalance$ = writable<FixedNumber | undefined>();
  const stake$ = writable<FixedNumber | undefined>();

  let accountId$ = wallet.accountId$;

  $: fetchNearBalance($accountId$);
  $: fetchStake($validatorContract$, $accountId$);

  async function fetchNearBalance(accountId?: string) {
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
    nearBalance$.set(
      new FixedNumber(json.result.amount, 24).sub(
        new FixedNumber(json.result.locked, 24),
      ),
    );
  }

  async function fetchStake(c: Promise<ValidatorContract>, accountId?: string) {
    if (!accountId) return;
    const contract = await c;
    const account = await contract.get_account({ account_id: accountId });
    stake$.set(new FixedNumber(account.staked_balance, 24));
    console.log("ACCOUNT", account);
  }

  async function openDepositModal() {
    modalSize$.set(ModalSize.Small);
    modal$.set(
      bind(Stake, {
        nearBalance$,
        stake$,
        afterUpdateBalances: () => {
          fetchNearBalance($accountId$);
          fetchStake($validatorContract$, $accountId$);
        },
      }),
    );
  }
</script>

<div class="stake">
  <h1>Stake with our validator!</h1>

  {#if $accountId$ == null}
    <div class="section-field">You are not connected. Please login!</div>
    <Button
      variant="outlined"
      on:click={data.isTG ? wallet.loginViaHere : showWalletSelector}
    >
      Login
    </Button>
  {:else}
    <div class="section-field">
      <span>Connected account:</span>
      <span>{$accountId$}</span>
    </div>
  {/if}
  <div class="section-field">
    <span>Near balance:</span>
    <span>{$nearBalance$ ? $nearBalance$.format() : "-"}</span>
    {#if $nearBalance$ != null && $nearBalance$.toNumber() < 0.5}
      <MessageBox type="warning">
        Your Near balance is low! Please top up your Near balance to not run out
        of gas.
      </MessageBox>
    {/if}
  </div>
  <div class="section-field">
    <span>Validator stake:</span>
    <span>{$stake$ ? $stake$.format() : "-"}</span>
    <Button on:click={openDepositModal}>Stake / Unstake</Button>
  </div>
</div>

<style lang="scss">
  .stake {
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
  }

  h1 {
    text-align: center;
    margin-bottom: 0.8rem;
  }
</style>
