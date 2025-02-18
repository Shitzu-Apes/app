<script lang="ts">
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";
  import { writable } from "svelte/store";
  import { match } from "ts-pattern";

  import { page } from "$app/stores";
  import { useAccountBalanceQuery, useMcAccountQuery } from "$lib/api/queries";
  import { usePortfolioQuery } from "$lib/api/queries/portfolio";
  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";
  import FormatNumber from "$lib/components/FormatNumber.svelte";
  import Portfolio from "$lib/components/Portfolio.svelte";
  import { addToast } from "$lib/components/Toast.svelte";
  import LoadingLambo from "$lib/components/memecooking/Board/LoadingLambo.svelte";
  import Tabs from "$lib/components/memecooking/Board/Tabs.svelte";
  import MemeList from "$lib/components/memecooking/Profile/MemeList.svelte";
  import Revenue from "$lib/components/memecooking/Profile/Revenue.svelte";
  import { nearWallet } from "$lib/near";
  import { type McAccount } from "$lib/near/memecooking";
  import { fetchBlockHeight } from "$lib/near/rpc";
  import { FixedNumber } from "$lib/util";
  import { nearPrice } from "$lib/util/projectedMCap";

  $: accountId = $page.params.accountId;
  const { accountId$ } = nearWallet;

  $: isOwnAccount = accountId === $accountId$;
  $: displayAccountId =
    accountId.length > 24
      ? `${accountId.substring(0, 6)}...${accountId.slice(-4)}`
      : accountId;

  $: mcAccountQuery = useMcAccountQuery(accountId);

  $: portfolioQuery = usePortfolioQuery(accountId);
  $: portfolio = $portfolioQuery.data ?? null;

  const nearBalance = writable<FixedNumber | null>(null);
  $: balanceQuery = useAccountBalanceQuery(accountId);
  $: if ($balanceQuery.data) {
    nearBalance.set(
      new FixedNumber($balanceQuery.data.amount, 24).sub(
        new FixedNumber($balanceQuery.data.locked, 24),
      ),
    );
  } else {
    nearBalance.set(null);
  }

  let activeTab = "portfolio";
  $: tabs = match(isOwnAccount)
    .with(true, () => [
      {
        id: "portfolio",
        label: "Portfolio",
      },
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
        label: "Claim",
        getCount: (info: McAccount) =>
          info.claims.filter((claim) => claim.amount.toBigInt() > 0n).length,
      },
      {
        id: "created",
        label: "Created",
        getCount: (info: McAccount) => info.created.length,
      },
    ])
    .with(false, () => [
      {
        id: "portfolio",
        label: "Portfolio",
      },
      {
        id: "created",
        label: "Created Token",
        getCount: (info: McAccount) => info.created.length,
      },
    ])
    .exhaustive();

  async function update(
    outcome: FinalExecutionOutcome | FinalExecutionOutcome[] | undefined,
  ) {
    if (outcome == null) return;
    const ownAccountId = $accountId$;
    if (!ownAccountId) return;
    await fetchBlockHeight(outcome);
  }

  $: totalValue =
    portfolio?.tokens.reduce(
      (acc, token) => {
        const decimals =
          token.contract_id === "wrap.near" ? 24 : token.decimals ?? 18;
        const balance = Number(token.balance) / 10 ** decimals;
        const price = token.price
          ? (token.price * Number($nearPrice)) / 1e24
          : 0;
        return acc + balance * price;
      },
      $nearBalance ? ($nearBalance.toNumber() * Number($nearPrice)) / 1e24 : 0,
    ) ?? 0;
</script>

<a
  href="/board"
  class="text-white flex items-center hover:text-shitzu-3 mb-4 w-fit"
>
  <div class="i-mdi:chevron-left size-8" />
  Back
</a>

<section class="w-full flex flex-col items-center justify-center px-1">
  <!-- Welcome Banner -->
  <div class="w-full bg-gray-800 rounded-lg p-4 sm:p-6 mb-8">
    <div
      class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0"
    >
      <div class="flex items-center gap-4">
        <img
          src={SHITZU_POCKET}
          alt="shitzu pocket"
          class="size-16 sm:size-20 text-shitzu-4"
        />
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <h1 class="text-lg sm:text-xl font-bold text-white">
              {#if isOwnAccount}
                gm, {displayAccountId}
              {:else}
                {displayAccountId}'s Profile
              {/if}
            </h1>
            {#if isOwnAccount}
              <button
                class="p-1 text-gray-400 hover:text-white rounded-md"
                on:click={() => {
                  navigator.clipboard.writeText(accountId);
                  addToast({
                    type: "foreground",
                    data: {
                      type: "simple",
                      data: {
                        title: "Copied to clipboard",
                        description: "Address copied to clipboard",
                      },
                    },
                  });
                }}
                title="Copy address"
              >
                <div class="i-mdi:content-copy text-lg" />
              </button>
            {/if}
          </div>
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
      <div class="flex flex-col items-start sm:items-end">
        <span class="text-base sm:text-lg font-bold text-white"
          >Total Value</span
        >
        <span class="text-2xl sm:text-3xl font-light text-shitzu-4">
          $<FormatNumber number={totalValue} totalDigits={6} />
        </span>
      </div>
    </div>
  </div>

  <div class="w-full">
    {#if $mcAccountQuery.isLoading}
      <LoadingLambo />
    {:else if $mcAccountQuery.isError}
      <div class="text-red-500">Error loading account</div>
    {:else if $mcAccountQuery.data}
      <div class="grid lg:grid-cols-[2fr_minmax(300px,1fr)] gap-8">
        <!-- Left Panel with Tabs -->
        <div>
          <Tabs
            tabs={tabs.map((tab) => ({
              ...tab,
              label: tab.getCount
                ? `${tab.label} (${$mcAccountQuery.data ? tab.getCount($mcAccountQuery.data) : 0})`
                : tab.label,
            }))}
            bind:activeTab
            class="w-full text-sm"
          />

          {#if activeTab === "portfolio"}
            <Portfolio
              {accountId}
              {portfolio}
              nearBalance={$nearBalance}
              {portfolioQuery}
            />
          {:else if $mcAccountQuery.data && isOwnAccount}
            <MemeList
              props={activeTab === "not-finalized"
                ? { type: "not-finalized", data: $mcAccountQuery.data.deposits }
                : activeTab === "finalized"
                  ? { type: "finalized", data: $mcAccountQuery.data.claims }
                  : activeTab === "created"
                    ? { type: "created", data: $mcAccountQuery.data.created }
                    : { type: "created", data: $mcAccountQuery.data.created }}
              {isOwnAccount}
              {update}
            />
          {:else if $mcAccountQuery.data}
            <MemeList
              props={{ type: "created", data: $mcAccountQuery.data.created }}
              {isOwnAccount}
              {update}
            />
          {/if}
        </div>

        <!-- Right Panel with Revenue -->
        <div class="order-first lg:order-last">
          {#if isOwnAccount}
            <Revenue
              revenue={$mcAccountQuery.data?.revenue}
              shitstarClaim={$mcAccountQuery.data?.shitstarClaim}
              referralFees={$mcAccountQuery.data?.referralFees}
              withdrawFees={$mcAccountQuery.data?.withdrawFees}
              {update}
              {isOwnAccount}
            />
          {:else}
            <Revenue
              revenue={$mcAccountQuery.data?.revenue}
              shitstarClaim={$mcAccountQuery.data?.shitstarClaim}
              referralFees={$mcAccountQuery.data?.referralFees}
              withdrawFees={$mcAccountQuery.data?.withdrawFees}
              {update}
              {isOwnAccount}
            />
          {/if}
        </div>
      </div>
    {/if}
  </div>
</section>
