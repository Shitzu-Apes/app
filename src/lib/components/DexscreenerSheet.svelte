<script lang="ts">
  import DexscreenerChart from "./memecooking/Board/DexscreenerChart.svelte";

  import { BottomSheetContent } from "$lib/layout/BottomSheet";

  export let pool_id: string;
</script>

<BottomSheetContent variant="lime">
  <slot slot="header">
    <h2 class="prose prose-invert prose-lime px-4 text-2xl">
      DexScreener Chart
    </h2>
  </slot>
  <section class="px-3 py-6 text-white h-[80vh]">
    <DexscreenerChart {pool_id} showTrade />
  </section>
</BottomSheetContent>

<style>
  :global(#dexscreener-embed iframe) {
    height: 100% !important;
  }
</style>
