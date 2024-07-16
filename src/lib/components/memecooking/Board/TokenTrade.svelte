<script lang="ts">
  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";

  export let symbol: string;
  export let trades: {
    account: string;
    type: "buy" | "sell";
    near: number;
    amount: number;
    date: string;
    transaction: string;
  }[];

  let secondsAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diff = now.getTime() - then.getTime();
    return Math.floor(diff / 1000);
  };
</script>

<ul class="w-full flex flex-col gap-1 text-sm">
  <li
    class="flex justify-between items-center p-2 bg-gray-600 rounded-lg text-white"
  >
    <span class="w-1/5 text-start">account</span>
    <span class="w-1/5 text-start">type</span>
    <span class="w-1/5 text-start">NEAR</span>
    <span class="w-1/5 text-start uppercase">{symbol}</span>
    <span class="w-1/5 text-start">date</span>
    <span class="w-1/5 text-start">transaction</span>
  </li>
  {#each trades as trade (trade.transaction)}
    <li
      class="flex justify-between items-center p-2 bg-gray-600 rounded-lg text-white"
    >
      <span class="w-1/5 text-start flex items-center gap-1">
        <img src={SHITZU_POCKET} alt="Shitzu Pocket" class="size-4" />
        <span class="bg-shitzu-4 px-1 rounded text-black">{trade.account}</span>
      </span>
      <span class="w-1/5 text-start">
        <span class={trade.type === "buy" ? "text-green-500" : "text-red-500"}>
          {trade.type}
        </span>
      </span>
      <span class="w-1/5 text-start">{trade.near.toFixed(4)}</span>
      <span class="w-1/5 text-start">{trade.amount.toFixed(2)}k</span>
      <span class="w-1/5 text-start">{secondsAgo(trade.date)}s ago</span>
      <a
        href={`https://nearblocks.io/tx/${trade.transaction}`}
        target="_blank"
        rel="noopener noreferrer"
        class="w-1/5 text-start hover:text-shitzu-4 hover:underline"
        >{trade.transaction}</a
      >
    </li>
  {/each}
</ul>
