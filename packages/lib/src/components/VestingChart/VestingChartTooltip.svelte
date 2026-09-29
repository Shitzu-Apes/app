<script lang="ts">
  export let selected: {
    time: number;
    vested: number;
    liquidityPool: number;
    depositor: number;
    circulatingSupply: number;
  } | null;
  export let xScale: (x: number) => number;
  export let yScale: (y: number) => number;
  export let height: number;
  export let margin: { top: number; bottom: number };
  export let strokeWidth: number;
</script>

{#if selected}
  <line
    x1={xScale(selected.time)}
    y1={height - margin.bottom}
    x2={xScale(selected.time)}
    y2={margin.top}
    stroke="white"
    stroke-opacity="0.5"
    stroke-width={strokeWidth}
    stroke-dasharray="5,5"
  />
  <circle
    cx={xScale(selected.time)}
    cy={yScale(
      selected.time < 0 ? selected.depositor : selected.circulatingSupply,
    )}
    r={3}
    fill={selected.time < 0 ? "#2196F3" : "#00f0f0"}
  />
  <circle
    cx={xScale(selected.time)}
    cy={yScale(
      selected.time < 0 ? selected.liquidityPool : selected.circulatingSupply,
    )}
    r={3}
    fill={selected.time < 0 ? "#4CAF50" : "#00f0f0"}
  />
  <circle
    cx={xScale(selected.time)}
    cy={yScale(selected.vested)}
    r={3}
    class="text-lime-400"
    fill="currentColor"
  />
{/if}
