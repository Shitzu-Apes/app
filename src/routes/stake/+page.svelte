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
  const withdraw$ = writable<FixedNumber | undefined>();
  let canWithdraw = false;
  const totalStakers$ = $validatorContract$.then((contract) =>
    contract.get_number_of_accounts(undefined),
  );
  let totalStaked$: Promise<FixedNumber>;

  let accountId$ = wallet.accountId$;

  $: fetchNearBalance($accountId$);
  $: fetchStake($validatorContract$, $accountId$);
  fetchTotalStake();

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
    withdraw$.set(new FixedNumber(account.unstaked_balance, 24));
    canWithdraw = account.can_withdraw;
  }

  async function fetchTotalStake() {
    totalStaked$ = $validatorContract$
      .then((contract) => contract.get_pool_summary(undefined))
      .then((summary) => new FixedNumber(summary.total_staked_balance, 24));
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
          fetchTotalStake();
          $modal$ = null;
        },
      }),
    );
  }

  let loading = false;
  async function withdraw() {
    loading = true;
    await wallet.signAndSendTransaction(
      {
        receiverId: import.meta.env.VITE_VALIDATOR_CONTRACT_ID,
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: "withdraw_all",
              args: {},
              gas: 30_000_000_000_000,
              deposit: "0",
            },
          },
        ],
      },
      {
        onSuccess: () => {
          fetchNearBalance($accountId$);
          fetchStake($validatorContract$, $accountId$);
          fetchTotalStake();
        },
        onFinally: () => {
          loading = false;
        },
      },
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
    <span>Your wallet balance:</span>
    <span>{$nearBalance$ ? `${$nearBalance$.format()} NEAR` : "-"}</span>
    {#if $nearBalance$ != null && $nearBalance$.toNumber() < 0.5}
      <MessageBox type="warning">
        Your Near balance is low! Please top up your Near balance to not run out
        of gas.
      </MessageBox>
    {/if}
  </div>
  <div class="section-field">
    <span>Your validator stake:</span>
    <span>{$stake$ ? `${$stake$.format()} NEAR` : "-"}</span>
    <Button on:click={openDepositModal}>Stake / Unstake</Button>
  </div>
  {#if $withdraw$ != null && $withdraw$.valueOf() > 0}
    <div class="section-field">
      <span>
        {#if canWithdraw}
          Available for withdrawal:
        {:else}
          Pending unstake:
        {/if}
      </span>
      <span>{$withdraw$.format()} NEAR</span>

      {#if canWithdraw}
        <Button on:click={withdraw} disabled={loading}>Withdraw</Button>
      {/if}
    </div>
  {/if}
  <div class="section-field">
    <span>Total validator stake:</span>
    <span>
      {#await totalStaked$}
        -
      {:then totalStaked}
        {totalStaked.format()} NEAR
      {/await}
    </span>
  </div>
  <div class="section-field">
    <span>Total unique stakers:</span>
    <span>
      {#await totalStakers$}
        -
      {:then totalStakers}
        {totalStakers}
      {/await}
    </span>
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
