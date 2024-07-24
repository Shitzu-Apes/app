<script lang="ts">
  import Trades from "./Trades.svelte";

  import type { paths } from "$lib/api/openapi";

  export let meme_id: number;
  export let symbol: string;
  export let trades: Promise<
    Array<
      paths["/trades"]["get"]["responses"]["200"]["content"]["application/json"][number] & {
        tokenAmount: number;
      }
    >
  >;
</script>

<ul class="w-full flex flex-col gap-1 text-xs">
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
  {#await trades}
    <li
      class="flex justify-between items-center p-2 bg-gray-600 rounded-lg text-white loader h-8"
    ></li>
  {:then trades}
    <Trades {trades} {meme_id} />
  {/await}
</ul>
