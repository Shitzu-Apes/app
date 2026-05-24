<script lang="ts">
  import type { PricePoint } from "$lib/util/pricePoints";

  import Chart from "./Chart.svelte";

  let ref: HTMLDivElement | undefined = undefined;
  export let data: PricePoint[] = [];
</script>

<div class="w-full h-full" bind:this={ref}>
  {#if ref}
    <Chart
      width={ref.clientWidth}
      height={ref.clientWidth * 0.55}
      {data}
      on:hover
    />
  {/if}
</div>
