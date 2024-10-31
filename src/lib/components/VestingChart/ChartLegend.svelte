<script lang="ts">
  import { readableDuration } from "$lib/util/timesAgo";

  export let selected: {
    time: number;
    vested: number;
    liquidityPool: number;
    depositor: number;
    circulatingSupply: number;
  } | null = null;
  export let margin: { left: number; top: number };
  export let width: number;
  export let fontSize: number;
</script>

<g transform="translate({margin.left}, {margin.top * 0.5})">
  <text x={0} y="0" fill="currentColor" font-size={fontSize}>
    Time {selected ? readableDuration(selected.time, 2) : ""}
  </text>
  <text x={width * 0.25} y="0" fill="#a3e635" font-size={fontSize}>
    Team {selected ? selected.vested.toFixed(1) + "%" : ""}
  </text>
  <text
    x={width * 0.5}
    y="0"
    fill={selected?.time && selected.time < 0 ? "#4CAF50" : "#00f0f0"}
    font-size={fontSize}
  >
    {selected?.time && selected.time < 0 ? "Ref " : "Circulating Supply "}
    {selected
      ? (selected.time < 0
          ? selected.liquidityPool.toFixed(1)
          : selected.circulatingSupply.toFixed(1)) + "%"
      : ""}
  </text>
  {#if selected && selected.time < 0}
    <text x={width * 0.75} y="0" fill="#2196F3" font-size={fontSize}>
      Depositor {(selected.depositor - selected.liquidityPool).toFixed(1)}%
    </text>
  {/if}
</g>
