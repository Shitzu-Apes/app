<script lang="ts">
  import { FixedNumber } from "@tarnadas/fixed-number";
  import { writable } from "svelte/store";
  import { slide } from "svelte/transition";

  import { showWalletSelector } from "$lib/auth";
  import { Stake, ValidatorStatistics } from "$lib/components";
  import MessageBox from "$lib/components/MessageBox.svelte";
  import { modal$ } from "$lib/layout";
  import {
    validatorContract$,
    wallet,
    type ValidatorContract,
  } from "$lib/near";

  const nearBalance$ = writable<FixedNumber | undefined>();
  const stake$ = writable<FixedNumber | undefined>();
  const withdraw$ = writable<FixedNumber | undefined>();
  let canWithdraw = false;
  let totalStakers$: number | null = null;
  let totalStaked$: FixedNumber | null = null;

  let accountId$ = wallet.accountId$;

  $: fetchNearBalance($accountId$);
  $: fetchStake($validatorContract$, $accountId$);
  fetchTotalStake();

  async function fetchNearBalance(accountId?: string) {
    if (accountId == null) {
      $nearBalance$ = undefined;
      return;
    }
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
    if (accountId == null) {
      $stake$ = undefined;
      $withdraw$ = undefined;
      return;
    }
    const contract = await c;
    const account = await contract.get_account({ account_id: accountId });
    stake$.set(new FixedNumber(account.staked_balance, 24));
    withdraw$.set(new FixedNumber(account.unstaked_balance, 24));
    canWithdraw = account.can_withdraw;
  }

  async function fetchTotalStake() {
    totalStaked$ = await $validatorContract$
      .then((contract) => contract.get_pool_summary(undefined))
      .then((summary) => new FixedNumber(summary.total_staked_balance, 24));

    totalStakers$ = await $validatorContract$.then((contract) =>
      contract.get_number_of_accounts(undefined),
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

<div class="w-full">
  <div class="text-center mb-6" class:pb-6={!$accountId$}>
    <h1 class="mb-0">Stake NEAR</h1>
    <div>With SHITZU and receive $DOGSHIT</div>
  </div>

  {#if $accountId$}
    <div
      class="pb-12 border-2 border-lime rounded-t-xl px-3 pt-3 bg-gradient-to-r from-lime to-emerald text-black"
    >
      <div class="flex justify-between items-center pb-6 border-b border-black">
        <div class="flex flex-col">
          <div class="flex items-center mb-3">
            <div>
              {#if $nearBalance$ != null && $nearBalance$.toNumber() < 0.5}
                Balance too low
              {:else}
                Available to stake
              {/if}
            </div>
            <div
              class="w-3 h-3 rounded-full bg-cyan ml-2"
              class:bg-red={$nearBalance$ != null &&
                $nearBalance$.toNumber() < 0.5}
            />
          </div>
          <span class="text-xl font-bold">
            {$nearBalance$ ? `${$nearBalance$.format()} NEAR` : "-"}
          </span>
        </div>

        <div class="border-2 px-3 py-1 border border-lime rounded-full">
          <span>{$accountId$}</span>
        </div>
      </div>

      <div class="pt-6">
        <div class="flex flex-col">
          <div class="flex items-center mb-3">
            <div>Staked</div>
          </div>
          <span class="text-xl font-bold">
            {$stake$ ? `${$stake$.format()} NEAR` : "-"}
          </span>
        </div>
      </div>
    </div>
  {/if}
  <div
    class="-mt-6 z-10 pb-6 border-2 border-lime rounded-xl px-3 pt-3 bg-black"
  >
    {#if $accountId$ == null}
      <MessageBox>
        Please login in order to stake with Shitzu validator!
      </MessageBox>
    {:else if $nearBalance$ != null && $stake$ != null}
      <Stake
        walletConnected={$accountId$ != null}
        nearBalance={$nearBalance$}
        stake={$stake$}
        afterUpdateBalances={() => {
          fetchNearBalance($accountId$);
          fetchStake($validatorContract$, $accountId$);
          fetchTotalStake();
          $modal$ = null;
        }}
      >
        <button
          class="w-full py-3 bg-lime text-black rounded-xl mt-3"
          on:click={wallet.isTG ? wallet.loginViaHere : showWalletSelector}
        >
          Connect Wallet
        </button>
      </Stake>
    {:else}
      <div class="w-full" transition:slide>
        <div class="i-svg-spinners:6-dots-rotate w-12 h-12 bg-gray-7 m-a" />
      </div>
    {/if}
    {#if $withdraw$ != null && $withdraw$.valueOf() > 1_000}
      <div class="mt-6 pt-6 border-t border-lime" transition:slide>
        <div class="flex justify-between items-center">
          <div>
            <span class="flex flex-col mt-3">
              {#if canWithdraw}
                Available to withdraw
              {:else}
                Pending unstake:
              {/if}
            </span>
            <span class="font-bold">{$withdraw$.format()} NEAR</span>
          </div>

          <button
            class="px-2 py-2 text-black font-bold rounded-xl"
            on:click={withdraw}
            disabled={loading || !canWithdraw}
            class:bg-coolgray={!canWithdraw}
            class:bg-lime={canWithdraw}
          >
            Withdraw
          </button>
        </div>
      </div>
    {/if}
  </div>

  <ValidatorStatistics {totalStaked$} {totalStakers$} />
</div>
