<script lang="ts">
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";
  import { writable } from "svelte/store";
  import { match } from "ts-pattern";

  import { page } from "$app/stores";
  import { useAccountBalanceQuery, useMcAccountQuery } from "$lib/api/queries";
  import { type McAccount } from "$lib/api/queries/memecooking";
  import { usePortfolioQuery } from "$lib/api/queries/portfolio";
  import { createNearPriceQuery } from "$lib/api/queries/prices";
  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";
  import FormatNumber from "$lib/components/FormatNumber.svelte";
  import Portfolio from "$lib/components/Portfolio.svelte";
  import { addToast } from "$lib/components/Toast.svelte";
  import LoadingLambo from "$lib/components/memecooking/Board/LoadingLambo.svelte";
  import Tabs from "$lib/components/memecooking/Board/Tabs.svelte";
  import MemeList from "$lib/components/memecooking/Profile/MemeList.svelte";
  import Revenue from "$lib/components/memecooking/Profile/Revenue.svelte";
  import { nearWallet } from "$lib/near";
  import { fetchBlockHeight } from "$lib/near/rpc";
  import { FixedNumber } from "$lib/util";

  $: accountId = $page.params.accountId;
  const { accountId$ } = nearWallet;

  $: isOwnAccount = accountId === $accountId$;
  $: displayAccountId =
    accountId.length > 24
      ? `${accountId.substring(0, 6)}...${accountId.slice(-4)}`
      : accountId;

  $: mcAccountQuery = useMcAccountQuery(accountId);
  $: portfolioQuery = usePortfolioQuery(accountId);
  $: balanceQuery = useAccountBalanceQuery(accountId);
  $: nearPriceQuery = createNearPriceQuery();

  // Track overall loading state for the page
  $: isLoading =
    $mcAccountQuery.isLoading ||
    $portfolioQuery.isLoading ||
    $balanceQuery.isLoading ||
    $nearPriceQuery.isLoading;

  // Track overall error state
  $: hasError =
    $mcAccountQuery.isError ||
    $portfolioQuery.isError ||
    $balanceQuery.isError ||
    $nearPriceQuery.isError;

  const nearBalance = writable<FixedNumber | null>(null);
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
    await $mcAccountQuery.refetch();
  }

  function retryQueries() {
    $mcAccountQuery.refetch();
    $portfolioQuery.refetch();
    $balanceQuery.refetch();
    $nearPriceQuery.refetch();
  }

  $: totalValue =
    $portfolioQuery.data?.tokens.reduce(
      (acc, token) => {
        const decimals =
          token.contract_id === "wrap.near" ? 24 : token.decimals ?? 18;
        const balance = Number(token.balance) / 10 ** decimals;
        const price = token.price
          ? (token.price * Number($nearPriceQuery.data?.toNumber() ?? 0)) / 1e24
          : 0;
        return acc + balance * price;
      },
      $nearBalance
        ? ($nearBalance.toNumber() *
            Number($nearPriceQuery.data?.toNumber() ?? 0)) /
            1e24
        : 0,
    ) ?? 0;
</script>

<div class="w-full flex items-center justify-between mb-4">
  <a
    href="/board"
    class="text-white flex items-center hover:text-shitzu-3 w-fit"
  >
    <div class="i-mdi:chevron-left size-8" />
    Back
  </a>

  <button
    class="text-white flex items-center hover:text-shitzu-3 w-fit"
    on:click={retryQueries}
  >
    <div class="i-mdi:refresh size-4" />
  </button>
</div>

{#if isLoading}
  <div class="w-full flex flex-col items-center justify-center py-12">
    <LoadingLambo />
  </div>
{:else if hasError}
  <div class="w-full flex flex-col items-center justify-center py-12 px-4">
    <div class="text-red-500 text-center mb-4">
      <div class="i-mdi:alert-circle text-5xl mx-auto mb-2"></div>
      <h2 class="text-xl font-bold">Failed to load profile data</h2>
      <p class="mt-2">
        We encountered an error while fetching your profile information.
      </p>
    </div>
    <button
      class="px-4 py-2 bg-shitzu-4 hover:bg-shitzu-5 text-black rounded-lg transition-colors"
      on:click={retryQueries}
    >
      Retry
    </button>
  </div>
{:else}
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
            {#if $portfolioQuery.isLoading}
              <div class="py-8 flex justify-center">
                <LoadingLambo />
              </div>
            {:else if $portfolioQuery.isError}
              <div class="py-8 text-center">
                <div class="text-red-500 mb-4">
                  <div class="i-mdi:alert-circle text-3xl mx-auto mb-2"></div>
                  <p>Failed to load portfolio data</p>
                </div>
                <button
                  class="px-3 py-1 bg-shitzu-4 hover:bg-shitzu-5 text-black rounded-lg text-sm"
                  on:click={() => $portfolioQuery.refetch()}
                >
                  Retry
                </button>
              </div>
            {:else}
              <Portfolio
                {accountId}
                portfolio={$portfolioQuery.data ?? null}
                nearBalance={$nearBalance}
                {portfolioQuery}
                nearPrice={$nearPriceQuery.data ?? new FixedNumber("0", 24)}
              />
            {/if}
          {:else if $mcAccountQuery.isLoading}
            <div class="py-8 flex justify-center">
              <LoadingLambo />
            </div>
          {:else if $mcAccountQuery.isError}
            <div class="py-8 text-center">
              <div class="text-red-500 mb-4">
                <div class="i-mdi:alert-circle text-3xl mx-auto mb-2"></div>
                <p>Failed to load account data</p>
              </div>
              <button
                class="px-3 py-1 bg-shitzu-4 hover:bg-shitzu-5 text-black rounded-lg text-sm"
                on:click={() => $mcAccountQuery.refetch()}
              >
                Retry
              </button>
            </div>
          {:else if $mcAccountQuery.data}
            {#if isOwnAccount}
              <MemeList
                props={activeTab === "not-finalized"
                  ? {
                      type: "not-finalized",
                      data: $mcAccountQuery.data.deposits,
                    }
                  : activeTab === "finalized"
                    ? { type: "finalized", data: $mcAccountQuery.data.claims }
                    : activeTab === "created"
                      ? { type: "created", data: $mcAccountQuery.data.created }
                      : { type: "created", data: $mcAccountQuery.data.created }}
                {isOwnAccount}
                {update}
              />
            {:else}
              <MemeList
                props={{ type: "created", data: $mcAccountQuery.data.created }}
                {isOwnAccount}
                {update}
              />
            {/if}
          {/if}
        </div>

        <!-- Right Panel with Revenue -->
        <div class="order-first lg:order-last">
          {#if $mcAccountQuery.isLoading}
            <div class="py-8 flex justify-center">
              <LoadingLambo />
            </div>
          {:else if $mcAccountQuery.isError}
            <div class="py-8 text-center">
              <div class="text-red-500 mb-4">
                <div class="i-mdi:alert-circle text-3xl mx-auto mb-2"></div>
                <p>Failed to load revenue data</p>
              </div>
              <button
                class="px-3 py-1 bg-shitzu-4 hover:bg-shitzu-5 text-black rounded-lg text-sm"
                on:click={() => $mcAccountQuery.refetch()}
              >
                Retry
              </button>
            </div>
          {:else if isOwnAccount}
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
    </div>
  </section>
{/if}
