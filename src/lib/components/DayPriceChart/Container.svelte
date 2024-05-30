<script lang="ts">
  import Chart from "./Chart.svelte";

  let ref: HTMLDivElement | undefined = undefined;
  export let data;

  $: console.log({ data: data });

  $: ref && console.log(ref.clientHeight);
</script>

<div class="w-full h-full mt-6" bind:this={ref}>
  {#if ref}
    <Chart width={ref.clientWidth} height={ref.clientWidth * 0.5} {data} />
  {/if}
</div>
