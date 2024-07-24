<script lang="ts">
  import { createTabs, melt } from "@melt-ui/svelte";

  import { page } from "$app/stores";
  import { client } from "$lib/api/client";
  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";
  import ClaimList from "$lib/components/memecooking/Profile/ClaimList.svelte";
  import CoinCreated from "$lib/components/memecooking/Profile/CoinCreated.svelte";
  import DepositList from "$lib/components/memecooking/Profile/DepositList.svelte";
  // import { MemeCooking } from "$lib/near";

  const { accountId } = $page.params;

  $: profileInfo = client
    .GET("/profile/{accountId}", {
      params: {
        path: { accountId },
      },
    })
    .then((res) => {
      console.log("[profileInfo]", res);
      return res.data;
    });

  const tabs = [
    { id: "not-finalized", label: "virtual coins held" },
    { id: "finalized", label: "coins held" },
    { id: "created", label: "coin created" },
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
          {tab.label}
        </button>
      {/each}
    </div>
  </div>

  {#await profileInfo}
    <div class="i-svg-spinners:pulse-3 size-6" />
  {:then info}
    {#if info}
      <section use:melt={$content(tabs[0].id)}>
        <DepositList deposits={info.virtual_coins} />
      </section>
      <section use:melt={$content(tabs[1].id)}>
        <ClaimList claims={info.coins_held} />
      </section>
      <section use:melt={$content(tabs[2].id)}>
        <CoinCreated coins={info.coin_created} />
      </section>
    {/if}
  {/await}
</section>
