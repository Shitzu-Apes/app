<script lang="ts">
  import { createTabs, melt } from "@melt-ui/svelte";

  import TokenComment from "../TokenComment.svelte";
  import TokenTrade from "../TokenTrade.svelte";

  import { client } from "$lib/api/client";
  import type { MCMemeInfoWithReference } from "$lib/models/memecooking";

  export let meme: MCMemeInfoWithReference;

  const tabs = [
    { id: "thread", label: "Thread" },
    { id: "trade", label: "Trade" },
  ];

  const trades = Promise.all([
    client.GET("/deposit", {
      params: {
        query: {
          meme_id: meme.id.toString(),
        },
      },
    }),
    client.GET("/withdraw", {
      params: {
        query: {
          meme_id: meme.id.toString(),
        },
      },
    }),
  ]).then(([deposits, withdraws]) => {
    console.log("[deposits, withdraws]", deposits, withdraws);
    if (!deposits.data || !withdraws.data) return [];
    // merge deposits.data with withdraws.data (add flag for buy or sell)

    const trades = [
      ...deposits.data.map((deposit) => ({
        ...deposit,
        type: "buy",
      })),
      ...withdraws.data.map((withdraw) => ({
        ...withdraw,
        type: "sell",
      })),
    ];

    return trades;
  });

  const {
    elements: { root, list, content, trigger },
    states: { value },
  } = createTabs({
    defaultValue: tabs[0].id,
  });
</script>

<div use:melt={$root}>
  <div use:melt={$list} class="flex gap-1 my-4">
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

<section use:melt={$content(tabs[0].id)}>
  <TokenComment id={meme.id} />
</section>
<section use:melt={$content(tabs[1].id)}>
  <TokenTrade symbol={meme.symbol} {trades} />
</section>
