<script lang="ts">
  import { createTabs, melt } from "@melt-ui/svelte";

  import { page } from "$app/stores";
  import { client } from "$lib/api/client";
  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import ClaimList from "$lib/components/memecooking/Profile/ClaimList.svelte";
  import CoinCreated from "$lib/components/memecooking/Profile/CoinCreated.svelte";
  import DepositList from "$lib/components/memecooking/Profile/DepositList.svelte";
  import { MemeCooking } from "$lib/near";

  const { accountId } = $page.params;

  const fullAccount = MemeCooking.getAccount(accountId).then(
    async (account) => {
      if (!account) return;
      const data = await client.POST("/profile", {
        body: {
          meme_id: account
            ? account.deposits.map((deposit) => deposit[0].toString())
            : [],
          token_id: account ? account.claims.map((claim) => claim[0]) : [],
          account_id: accountId,
        },
      });
      const deposits = account.deposits.map((deposit) => ({
        meme_id: deposit[0].toString(),
        amount: deposit[1].toString(),
        meme: data.data?.meme_info[deposit[0].toString()],
      }));
      const claims = account.claims.map((claim) => ({
        token_id: claim[0].toString(),
        amount: claim[1].toString(),
        meme: data.data?.token_info[claim[0].toString()],
      }));

      return {
        account,
        deposits,
        claims,
        created: data.data?.coinsCreated,
      };
    },
  );

  fullAccount.then((account) => {
    console.log("[fullAccount]", account);
  });

  const tabs = [
    {
      id: "not-finalized",
      label: "withdraw Stake",
      info: "All ongoing staking and unsucsesful launches",
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

  <div use:melt={$root}>
    <div use:melt={$list} class="flex gap-1">
      {#each tabs as tab}
        <button
          use:melt={$trigger(tab.id)}
          class="{tab.id !== $value
            ? 'text-shitzu-4 bg-transparent'
            : 'text-dark bg-shitzu-4'} font-400 px-2 rounded"
        >
          <Tooltip info={tab.info}>
            {tab.label}
          </Tooltip>
        </button>
      {/each}
    </div>
  </div>

  {#await fullAccount}
    <div class="i-svg-spinners:pulse-3 size-6" />
  {:then info}
    {#if info}
      <section class="w-full max-w-xs" use:melt={$content(tabs[0].id)}>
        <DepositList deposits={info.deposits} />
      </section>
      <section class="w-full max-w-xs" use:melt={$content(tabs[1].id)}>
        <ClaimList claims={info.claims} />
      </section>
      <section class="w-full max-w-xs" use:melt={$content(tabs[2].id)}>
        <CoinCreated coins={info.created} />
      </section>
    {/if}
  {/await}
</section>
