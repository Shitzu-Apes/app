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

<div class="w-full overflow-x-auto h-full">
  <ul class="w-full flex flex-col gap-1 text-xs min-w-[500px]">
    <li
      class="flex [&>*]:mx-[0.1rem] justify-between items-center p-2 bg-gray-600 rounded-lg text-white"
    >
      <span class="flex-[0.5_1_5rem] text-start">account</span>
      <span class="flex-[0_0_3rem] text-start">type</span>
      <span class="flex-[0.1_0_5rem] text-start">NEAR</span>
      <span class="flex-[0.1_0_5rem] text-start">{symbol}</span>
      <span class="flex-[0.1_0_5rem] text-start">date</span>
      <span class="flex-[0.2_0_5rem] text-start">transaction</span>
    </li>
    {#await trades}
      <li
        class="flex justify-between items-center p-2 bg-gray-600 rounded-lg text-white loader h-8"
      ></li>
    {:then trades}
      <Trades {trades} {meme_id} />
    {/await}
  </ul>
</div>
