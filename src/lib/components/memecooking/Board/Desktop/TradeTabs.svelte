<script lang="ts">
  import { createTabs, melt } from "@melt-ui/svelte";

  import TokenCommentSection from "../TokenCommentSection.svelte";
  import TokenTrade from "../TokenTrade.svelte";

  import { client } from "$lib/api/client";
  import type { Meme } from "$lib/models/memecooking";
  import { predictedTokenAmount } from "$lib/util/predictedTokenAmount";

  export let meme: Meme;

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
        tokenAmount: predictedTokenAmount({
          amount: trade.amount,
          total_deposit: meme.total_deposit,
          total_supply: meme.total_supply || undefined,
        }),
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

<section
  class="{$value === 'thread' ? 'flex' : ''} flex-col flex-1"
  use:melt={$content(tabs[0].id)}
>
  <TokenCommentSection {meme} />
</section>
<section
  class="{$value === 'trade' ? 'flex' : ''} flex-col flex-1"
  use:melt={$content(tabs[1].id)}
>
  <TokenTrade memebid={meme} {trades} paginated />
</section>
