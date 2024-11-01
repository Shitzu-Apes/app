<script lang="ts">
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";
  import { onDestroy, onMount } from "svelte";
  import { derived } from "svelte/store";
  import { match } from "ts-pattern";

  import { page } from "$app/stores";
  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";
  import LoadingLambo from "$lib/components/memecooking/Board/LoadingLambo.svelte";
  import Tabs from "$lib/components/memecooking/Board/Tabs.svelte";
  import MemeList from "$lib/components/memecooking/Profile/MemeList.svelte";
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
  $: displayAccountId =
    accountId.length > 24
      ? `${accountId.substring(0, 6)}...${accountId.slice(-4)}`
      : accountId;

  let account: McAccount | undefined;
  const unsubscribe = derived([accountId$, page], (res) => res).subscribe(
    ([ownAccountId, page]) => {
      if (ownAccountId === page.params.accountId) return;
      fetchMcAccount(page.params.accountId).then((acc) => {
        account = acc;
      });
    },
  );
  onDestroy(() => {
    unsubscribe();
  });

  onMount(() => {
    if (!$accountId$ || !isOwnAccount) return;
    updateMcAccount($accountId$);
  });

  let activeTab = isOwnAccount ? "not-finalized" : "created";
  $: tabs = match(isOwnAccount)
    .with(true, () => [
      {
        id: "not-finalized",
        label: `Withdraw`,
        getCount: (info: McAccount) =>
          info.deposits.filter(
            (deposit) =>
              deposit.meme.end_timestamp_ms != null &&
              deposit.meme.end_timestamp_ms < Date.now(),
          ).length,
      },
      {
        id: "finalized",
        label: "Claim Token",
        getCount: (info: McAccount) =>
          info.claims.filter((claim) => claim.amount.valueOf() > 0n).length,
      },
      {
        id: "created",
        label: "Created Token",
        getCount: () => 0,
      },
    ])
    .with(false, () => [
      {
        id: "created",
        label: "Created Token",
        getCount: () => 0,
      },
    ])
    .exhaustive();

  async function update(
    outcome: FinalExecutionOutcome | FinalExecutionOutcome[] | undefined,
  ) {
    if (outcome == null) return;
    const ownAccountId = $accountId$;
    if (!ownAccountId) return;
    const blockHeight = await fetchBlockHeight(outcome);
    updateMcAccount(ownAccountId, true, blockHeight + 5);
  }
</script>

<section class="w-full flex flex-col items-center justify-center px-4 py-8">
  <!-- Welcome Banner -->
  <div class="w-full bg-gray-800 rounded-lg p-6 mb-8">
    <div class="flex items-center gap-4">
      <img
        src={SHITZU_POCKET}
        alt="shitzu pocket"
        class="size-20 text-shitzu-4"
      />
      <div class="flex flex-col gap-2">
        <h1 class="text-xl font-bold text-white">
          {#if isOwnAccount}
            gm, {displayAccountId}!
          {:else}
            {displayAccountId}'s Profile
          {/if}
        </h1>
        <a
          href="https://pikespeak.ai/wallet-explorer/{accountId}/"
          target="_blank"
          rel="noopener noreferrer"
          class="text-shitzu-4 hover:text-shitzu-5 hover:underline flex items-center gap-1"
        >
          <span>View on Explorer</span>
          <div class="i-mdi:external-link text-lg" />
        </a>
      </div>
    </div>
  </div>

  <div class="w-full">
    {#await $mcAccount$}
      <LoadingLambo />
    {:then info}
      <div class="w-full flex flex-col md:flex-row gap-8">
        <!-- Left Panel with Tabs -->
        <div class="w-full md:w-2/3">
          <Tabs
            tabs={tabs.map((tab) => ({
              ...tab,
              label: `${tab.label} (${info ? tab.getCount(info) : 0})`,
            }))}
            bind:activeTab
            class="w-full"
          />

          {#if info && isOwnAccount}
            <MemeList
              props={activeTab === "not-finalized"
                ? { type: "not-finalized", data: info.deposits }
                : activeTab === "finalized"
                  ? { type: "finalized", data: info.claims }
                  : { type: "created", data: info.created }}
              {isOwnAccount}
              {update}
            />
          {:else if account != null}
            <MemeList
              props={{ type: "created", data: account.created }}
              {isOwnAccount}
              {update}
            />
          {/if}
        </div>

        <!-- Right Panel with Revenue -->
        <div class="w-full md:w-1/3 order-first md:order-last">
          {#if isOwnAccount}
            <Revenue
              revenue={info?.revenue}
              shitstarClaim={info?.shitstarClaim}
              referralFees={info?.referralFees}
              withdrawFees={info?.withdrawFees}
              {update}
              {isOwnAccount}
            />
          {:else}
            <Revenue
              revenue={account?.revenue}
              shitstarClaim={account?.shitstarClaim}
              referralFees={account?.referralFees}
              withdrawFees={account?.withdrawFees}
              {update}
              {isOwnAccount}
            />
          {/if}
        </div>
      </div>
    {/await}
  </div>
</section>
