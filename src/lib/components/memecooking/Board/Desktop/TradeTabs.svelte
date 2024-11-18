<script lang="ts">
  import Tabs from "../Tabs.svelte";
  import TokenCommentSection from "../TokenCommentSection.svelte";
  import TokenTrade from "../TokenTrade.svelte";

  import { client } from "$lib/api/client";
  import type { Meme } from "$lib/models/memecooking";
  import { predictedTokenAmount } from "$lib/util/predictedTokenAmount";

  export let meme: Meme;

  const tabs = [
    { id: "thread", label: "Thread" },
    { id: "trade", label: "Activity" },
  ];

  let activeTab = tabs[0].id;

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
          amount: trade.amount!,
          total_deposit: meme.total_deposit,
          total_supply: meme.total_supply || undefined,
        }),
      }));

      return trades.sort(
        (a, b) => Number(b.timestamp_ms) - Number(a.timestamp_ms),
      );
    });
</script>

<Tabs {tabs} bind:activeTab class="w-full max-w-md mx-auto mb-2" />

{#if activeTab === "thread"}
  <div class="flex flex-col flex-1">
    <TokenCommentSection {meme} />
  </div>
{:else if activeTab === "trade"}
  <div class="flex flex-col flex-1">
    <TokenTrade memebid={meme} {trades} paginated />
  </div>
{/if}
