<script lang="ts">
  import Chart from "./Chart.svelte";

  let ref: HTMLDivElement | undefined = undefined;
  export let data;
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
