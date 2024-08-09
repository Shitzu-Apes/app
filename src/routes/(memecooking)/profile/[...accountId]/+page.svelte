<script lang="ts">
  import { createTabs, melt } from "@melt-ui/svelte";
  import type { FinalExecutionOutcome } from "@near-wallet-selector/core";
  import { slide } from "svelte/transition";

  import { page } from "$app/stores";
  import { client } from "$lib/api/client";
  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import ClaimList from "$lib/components/memecooking/Profile/ClaimList.svelte";
  import CoinCreated from "$lib/components/memecooking/Profile/CoinCreated.svelte";
  import DepositList from "$lib/components/memecooking/Profile/DepositList.svelte";
  import { MemeCooking } from "$lib/near";
  import { fetchBlockHeight } from "$lib/near/rpc";
  import { awaitRpcBlockHeight } from "$lib/store/indexer";
  import { getTokenId } from "$lib/util/getTokenId";

  const { accountId } = $page.params;

  let fullAccount: ReturnType<typeof fetchFullAccount> = new Promise<never>(
    () => {},
  );

  fetchFullAccount();
  function fetchFullAccount(blockHeight?: number) {
    const res = Promise.all([
      MemeCooking.getAccount(accountId),
      MemeCooking.getUnclaimed(accountId),
      blockHeight != null
        ? awaitRpcBlockHeight(blockHeight)
        : Promise.resolve(),
    ]).then(async ([account, unclaimed]) => {
      if (!account || !unclaimed) return;
      const { data } = await client.POST("/profile", {
        body: {
          meme_id: account
            ? [
                ...account.deposits.map((deposit) => deposit[0].toString()),
                ...(unclaimed || []).map((claim) => claim.toString()),
              ]
            : [],
          account_id: accountId,
          token_id: account.income.map((income) => income[0].toString()),
        },
        headers:
          blockHeight != null
            ? {
                "X-Block-Height": String(blockHeight),
              }
            : {},
      });
      if (!data) {
        throw new Error(`Account ${accountId} not found`);
      }
      const deposits = account.deposits
        .map((deposit) => {
          const meme = data.meme_info[deposit[0].toString()];
          if (!meme) return null;
          return {
            meme_id: deposit[0],
            amount: deposit[1].toString(),
            meme,
          };
        })
        .filter(
          (deposit): deposit is NonNullable<typeof deposit> => deposit != null,
        );
      let claims = await Promise.all(
        unclaimed.map(async (meme_id) => {
          // find meme id from data
          const meme = data.meme_info[meme_id.toString()];
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
      ).then((claims) =>
        claims.filter((claim): claim is NonNullable<typeof claim> => {
          return (
            claim != null &&
            +claim.amount > 0 &&
            unclaimed.find((memeId) => memeId === claim.meme.meme_id) != null
          );
        }),
      );

      const revenue = account.income.map((income) => ({
        token_id: income[0].toString(),
        amount: income[1].toString(),
        meme: data.token_info[income[0].toString()],
      }));

      console.log("[claims]", claims);
      console.log("[revenue]", revenue);

      return {
        account,
        deposits,
        claims,
        created: data.coinsCreated,
        revenue,
      };
    });
    fullAccount = res;
    return res;
  }

  fullAccount.then((account) => {
    console.log("[fullAccount]", account);
  });

  const tabs = [
    {
      id: "not-finalized",
      label: "withdraw Stake",
      info: "All ongoing staking and unsuccesful launches",
    },
    {
      id: "finalized",
      label: "claim Token",
      info: "Successful launches",
    },
    {
      id: "created",
      label: "created Token",
      info: "All tokens created by this account",
    },
  ];

  const {
    elements: { root, list, content, trigger },
    states: { value },
  } = createTabs({
    defaultValue: tabs[0].id,
  });

  async function update(
    outcome: FinalExecutionOutcome | FinalExecutionOutcome[] | undefined,
  ) {
    // TODO
    if (outcome == null) return;
    let blockHeight: number;
    if (Array.isArray(outcome)) {
      blockHeight = await fetchBlockHeight(outcome[outcome.length - 1]);
    } else {
      blockHeight = await fetchBlockHeight(outcome);
    }
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
    {#if info && info.revenue}
      <!-- TODO -->
    {/if}

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
      <section class="w-full max-w-xs" use:melt={$content(tabs[0].id)}>
        <DepositList deposits={info.deposits} {update} />
      </section>
      <section class="w-full max-w-xs" use:melt={$content(tabs[1].id)}>
        <ClaimList claims={info.claims} {update} />
      </section>
      <section class="w-full max-w-xs" use:melt={$content(tabs[2].id)}>
        <CoinCreated coins={info.created} {update} />
      </section>
    {/if}
  {/await}
</section>
