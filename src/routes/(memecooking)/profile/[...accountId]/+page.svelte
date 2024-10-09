<script lang="ts">
  import { createTabs, melt } from "@melt-ui/svelte";
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";
  import { onDestroy } from "svelte";
  import { derived } from "svelte/store";
  import { slide } from "svelte/transition";
  import { match } from "ts-pattern";

  import { page } from "$app/stores";
  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import ClaimList from "$lib/components/memecooking/Profile/ClaimList.svelte";
  import CoinCreated from "$lib/components/memecooking/Profile/CoinCreated.svelte";
  import DepositList from "$lib/components/memecooking/Profile/DepositList.svelte";
  import Revenue from "$lib/components/memecooking/Profile/Revenue.svelte";
  import { wallet } from "$lib/near";
  import {
    fetchMcAccount,
    mcAccount$,
    updateMcAccount,
    type McAccount,
  } from "$lib/near/memecooking";
  import { fetchBlockHeight } from "$lib/near/rpc";

  $: accountId = $page.params.accountId;
  const { accountId$ } = wallet;

  $: isOwnAccount = accountId === $accountId$;

  let account: McAccount | undefined;
  const unsubscribe = derived([accountId$, page], (res) => res).subscribe(
    ([ownAccountId, page]) => {
      console.log("ownAccountId", ownAccountId);
      console.log("page.params.accountId", page.params.accountId);
      if (ownAccountId === page.params.accountId) return;
      fetchMcAccount(page.params.accountId).then((acc) => {
        account = acc;
      });
    },
  );
  onDestroy(() => {
    unsubscribe();
  });

  $: tabs = match(isOwnAccount)
    .with(true, () => [
      {
        id: "not-finalized",
        label: "withdraw",
        info: "All ongoing deposits and unsuccessful launches",
        component: DepositList,
      },
      {
        id: "finalized",
        label: "claim Token",
        info: "Successful launches",
        component: ClaimList,
      },
      {
        id: "created",
        label: "created Token",
        info: "All tokens created by this account",
        component: CoinCreated,
      },
    ])
    .with(false, () => [
      {
        id: "created",
        label: "created Token",
        info: "All tokens created by this account",
        component: CoinCreated,
      },
    ])
    .exhaustive();

  const {
    elements: { root, list, content, trigger },
    states: { value },
  } = createTabs();

  async function update(
    outcome: FinalExecutionOutcome | FinalExecutionOutcome[] | undefined,
  ) {
    if (outcome == null) return;
    const blockHeight = await fetchBlockHeight(outcome);
    // adding +5 here becauce of receipts being delayed
    const ownAccountId = await $accountId$;
    if (!ownAccountId) return;
    updateMcAccount(ownAccountId, blockHeight + 5);
  }
</script>

<section class="w-full flex flex-col items-center justify-center">
  <div class="my-6">
    <div class="flex">
      <img
        src={SHITZU_POCKET}
        alt="shitzu pocket"
        class="size-16 mr-1 text-shitzu-4"
      />
      <div>
        <p class="text-lg">
          {accountId.length > 24
            ? `${accountId.substring(0, 6)}...${accountId.slice(-4)}`
            : accountId}
        </p>
        <a
          href="https://pikespeak.ai/wallet-explorer/{accountId}/"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm text-shitzu-4 hover:underline hover:text-shitzu-5 hover:font-bold"
          >[view on explorer]</a
        >
      </div>
    </div>
  </div>

  {#await $mcAccount$}
    <div transition:slide class="i-svg-spinners:pulse-3 size-20 mt-[80px]" />
  {:then info}
    <Revenue
      revenue={info?.revenue}
      shitstarClaim={info?.shitstarClaim}
      referralFees={info?.referralFees}
      withdrawFees={info?.withdrawFees}
      {update}
      {isOwnAccount}
    />

    <div use:melt={$root}>
      <div use:melt={$list} class="flex gap-1">
        {#each tabs as tab, index}
          <Tooltip info={tab.info}>
            <button
              use:melt={$trigger(tab.id)}
              class="flex items-center {tab.id !== $value
                ? 'text-shitzu-4 bg-transparent'
                : 'text-dark bg-shitzu-4'} font-400 px-2 rounded"
            >
              {tab.label}
              {#if info != null}
                {#if index === 0 && info.deposits.filter((deposit) => deposit.meme.end_timestamp_ms != null && deposit.meme.end_timestamp_ms < Date.now()).length > 0}
                  <div class="ml-1 flex items-center text-sm text-red-4">
                    <div class="i-line-md:bell-twotone-alert-loop size-4" />
                    {info.deposits.filter(
                      (deposit) =>
                        deposit.meme.end_timestamp_ms != null &&
                        deposit.meme.end_timestamp_ms < Date.now(),
                    ).length}
                  </div>
                {:else if index === 1 && info.claims.filter((claim) => claim.amount.valueOf() > 0n).length > 0}
                  <div class="ml-1 flex items-center text-sm text-red-4">
                    <div class="i-line-md:bell-twotone-alert-loop size-4" />
                    {info.claims.filter((claim) => claim.amount.valueOf() > 0n)
                      .length}
                  </div>
                {/if}
              {/if}
            </button>
          </Tooltip>
        {/each}
      </div>
    </div>

    {#if info && isOwnAccount}
      {#each tabs as tab}
        <section class="w-full max-w-sm" use:melt={$content(tab.id)}>
          {#if tab.component === DepositList}
            <DepositList deposits={info.deposits} {update} />
          {:else if tab.component === ClaimList}
            <ClaimList claims={info.claims} {update} />
          {:else if tab.component === CoinCreated}
            <CoinCreated coins={info.created} {update} />
          {/if}
        </section>
      {/each}
    {:else if account != null}
      <CoinCreated coins={account.created} {isOwnAccount} {update} />
    {/if}
  {/await}
</section>
