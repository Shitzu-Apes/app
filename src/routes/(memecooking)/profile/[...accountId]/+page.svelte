<script lang="ts">
  import { createTabs, melt } from "@melt-ui/svelte";
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";
  import { slide } from "svelte/transition";
  import { match } from "ts-pattern";

  import { page } from "$app/stores";
  import { client } from "$lib/api/client";
  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import ClaimList from "$lib/components/memecooking/Profile/ClaimList.svelte";
  import CoinCreated from "$lib/components/memecooking/Profile/CoinCreated.svelte";
  import DepositList from "$lib/components/memecooking/Profile/DepositList.svelte";
  import Revenue from "$lib/components/memecooking/Profile/Revenue.svelte";
  import type { Meme } from "$lib/models/memecooking";
  import { wallet } from "$lib/near";
  import { MemeCooking } from "$lib/near/memecooking";
  import { fetchBlockHeight } from "$lib/near/rpc";
  import { awaitRpcBlockHeight } from "$lib/store/indexer";
  import { FixedNumber } from "$lib/util";
  import { getTokenId } from "$lib/util/getTokenId";
  import {
    sortMemeByEndtimestamp,
    sortMemeByUnclaimedThenEndTimestamp,
  } from "$lib/util/sortMemeByCreatedAt";

  const { accountId } = $page.params;
  const { accountId$ } = wallet;

  $: isOwnAccount = accountId === $accountId$;

  let fullAccount: ReturnType<typeof fetchFullAccount> = new Promise<never>(
    () => {},
  );

  fetchFullAccount();
  function fetchFullAccount(blockHeight?: number) {
    const res = Promise.all([
      MemeCooking.getAccount(accountId),
      MemeCooking.getUnclaimed(accountId),
      client
        .GET(`/profile/{accountId}`, {
          params: {
            path: {
              accountId,
            },
            headers:
              blockHeight != null
                ? {
                    "X-Block-Height": String(blockHeight),
                  }
                : {},
          },
        })
        .then((res) => {
          console.log("[Profile] fetching full account", res);
          if (!res.data) {
            throw new Error(`[Profile] Account ${accountId} not found`);
          }

          return res.data;
        })
        .catch((err) => {
          console.error("[Profile] fetching full account", err);
          return null;
        }),
      blockHeight != null
        ? awaitRpcBlockHeight(blockHeight)
        : Promise.resolve(),
    ]).then(async ([account, unclaimed, profile]) => {
      console.log("[Profile] fetching full account", {
        account,
        unclaimed,
        profile,
      });
      if (!account || !unclaimed || !profile) return;

      const meme_map = new Map<string, Meme>([
        ...(profile.virtual_coins.map((coin) => [
          coin.meme_id.toString(),
          coin,
        ]) as [string, Meme][]),
        ...(profile.coin_created.map((coin) => [
          coin.meme_id.toString(),
          coin,
        ]) as [string, Meme][]),
      ]);

      const deposits = account.deposits
        .map((deposit) => {
          const meme = meme_map.get(deposit[0].toString());
          if (!meme) return null;
          return {
            meme_id: deposit[0],
            amount: deposit[1].toString(),
            meme,
          };
        })
        .filter(
          (deposit): deposit is NonNullable<typeof deposit> => deposit != null,
        )
        .sort((a, b) => sortMemeByEndtimestamp(a.meme, b.meme));
      let unclaimedInfo = await Promise.all(
        unclaimed.map(async (meme_id) => {
          // find meme id from data
          const meme = meme_map.get(meme_id.toString());
          if (!meme) return null;
          const token_id = getTokenId(meme.symbol, meme.meme_id);
          const amount = await MemeCooking.getClaimable(
            accountId,
            meme.meme_id,
          );
          if (amount === null) return null;
          return {
            token_id,
            amount,
            meme,
          };
        }),
      );

      const claims = Array.from(
        new Set([
          ...unclaimedInfo,
          ...profile.coins_held.map((m) => m.meme_id),
        ]),
      )
        .map((meme_id) => {
          // try to get meme from unclaimedInfo
          const unclaimed = unclaimedInfo.find(
            (m) => m && m.meme.meme_id === meme_id,
          );
          if (unclaimed) return unclaimed;
          // try to get meme from profile.coins_held
          const meme = profile.coins_held.find((m) => m.meme_id === meme_id);
          if (meme)
            return {
              token_id: getTokenId(meme.symbol, meme.meme_id),
              amount: "0",
              meme,
            };
          return null;
        })
        .filter((claim): claim is NonNullable<typeof claim> => {
          return claim != null;
        })
        .sort((a, b) =>
          sortMemeByUnclaimedThenEndTimestamp(
            {
              unclaimed: BigInt(a.amount) > 0n,
              end_timestamp_ms: a.meme.end_timestamp_ms ?? 0,
            },
            {
              unclaimed: BigInt(b.amount) > 0n,
              end_timestamp_ms: b.meme.end_timestamp_ms ?? 0,
            },
          ),
        );

      const revenue = account.income.map((income) => ({
        token_id: income[0].toString(),
        amount: income[1].toString(),
        meme: meme_map.get(income[0].toString()),
      }));

      console.log("[claims]", claims);
      console.log("[revenue]", revenue);

      return {
        account,
        deposits,
        claims,
        created: profile.coin_created,
        revenue,
        referralFees: new FixedNumber(profile.referral_fees, 24),
        withdrawFees: new FixedNumber(profile.withdraw_fees, 24),
      };
    });
    fullAccount = res;
    return res;
  }

  fullAccount.then((account) => {
    console.log("[fullAccount]", account);
  });

  $: tabs = match(isOwnAccount)
    .with(true, () => [
      {
        id: "not-finalized",
        label: "withdraw Stake",
        info: "All ongoing staking and unsuccessful launches",
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
    fetchFullAccount(blockHeight + 5);
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
        <p class="text-lg">{accountId}</p>
        <a
          href="https://pikespeak.ai/wallet-explorer/{accountId}/"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm text-shitzu-4">[view on explorer]</a
        >
      </div>
    </div>
  </div>

  {#await fullAccount}
    <div transition:slide class="i-svg-spinners:pulse-3 size-20 mt-[80px]" />
  {:then info}
    <Revenue
      revenue={info?.revenue}
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
                {:else if index === 1 && info.claims.length > 0}
                  <div class="ml-1 flex items-center text-sm text-red-4">
                    <div class="i-line-md:bell-twotone-alert-loop size-4" />
                    {info.claims.length}
                  </div>
                {/if}
              {/if}
            </button>
          </Tooltip>
        {/each}
      </div>
    </div>

    {#if info}
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
    {/if}
  {/await}
</section>
