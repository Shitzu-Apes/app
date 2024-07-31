<script lang="ts">
  import { createTabs, melt } from "@melt-ui/svelte";

  import TokenComment from "../TokenComment.svelte";
  import TokenTrade from "../TokenTrade.svelte";

  import { client } from "$lib/api/client";
  import type { MCMemeInfoWithReference } from "$lib/models/memecooking";
  import { predictedTokenAmount } from "$lib/util/predictedTokenAmount";

  export let meme: MCMemeInfoWithReference;

  const tabs = [
    { id: "thread", label: "Thread" },
    { id: "trade", label: "Trade" },
  ];

  const trades = client
    .GET("/trades", {
      params: {
        query: {
          meme_id: meme.meme_id.toString(),
        },
      },
    })
    .then((trade) => {
      console.log("[trade]", trade);
      if (!trade.data) return [];

      const trades = trade.data.map((trade) => ({
        ...trade,
        tokenAmount: predictedTokenAmount({ ...trade, ...meme }),
      }));

      return trades.sort((a, b) => b.timestamp_ms - a.timestamp_ms);
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
  <TokenComment id={meme.telegram_discussion_id} />
</section>
<section use:melt={$content(tabs[1].id)}>
  <TokenTrade meme_id={meme.meme_id} symbol={meme.symbol} {trades} />
</section>
