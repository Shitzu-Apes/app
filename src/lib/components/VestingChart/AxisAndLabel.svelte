<script lang="ts">
  export let width: number;
  export let height: number;
  export let margin: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  export let fontSize: number;
  export let strokeWidth: number;
  export let totalDurationMs: number;
  export let cliffDurationMs: number;
  export let MS_PER_DAY: number;
  export let xScale: (x: number) => number;

  $: yAxisTicks = [0, 25, 50, 75, 100].map((t) => ({
    y:
      height -
      margin.bottom -
      (t / 100) * (height - margin.top - margin.bottom),
    label: `${t}%`,
  }));
</script>

<!-- Y-axis -->
<g class="text-white">
  {#each yAxisTicks as tick}
    <line
      x1={margin.left}
      y1={tick.y}
      x2={width - margin.right}
      y2={tick.y}
      stroke="currentColor"
      stroke-opacity="0.25"
      stroke-width={strokeWidth}
      stroke-dasharray="5,5"
    />
    <text
      x={width - margin.right}
      y={tick.y - 5}
      text-anchor="end"
      font-size={fontSize}
      fill-opacity="0.5"
      fill="#FFFFFF">{tick.label}</text
    >
  {/each}
</g>

{#if totalDurationMs !== 0 || cliffDurationMs !== 0}
  <!-- Auction end line -->
  <g class="text-white">
    <line
      x1={xScale(0)}
      y1={margin.top}
      x2={xScale(0)}
      y2={height - margin.bottom}
      stroke="currentColor"
      stroke-width={strokeWidth}
      stroke-dasharray="5,5"
    />
    <text
      x={xScale(0)}
      y={margin.top - 5}
      text-anchor="middle"
      font-size={fontSize}
      fill="currentColor">Auction end</text
    >
  </g>
{/if}

<!-- Cliff/Vesting line and label -->
{#if totalDurationMs === 0 && cliffDurationMs === 0}
  <!-- Combined instant case line -->
  <g class="text-white">
    <line
      x1={xScale(0)}
      y1={margin.top}
      x2={xScale(0)}
      y2={height - margin.bottom}
      stroke="currentColor"
      stroke-width={strokeWidth}
      stroke-dasharray="5,5"
    />
    <text
      x={xScale(0)}
      y={margin.top - 5}
      text-anchor="middle"
      font-size={fontSize}
      fill="currentColor">Auction end + Instant allocation</text
    >
  </g>
{:else if cliffDurationMs === totalDurationMs}
  <!-- Combined cliff and vesting line when they're equal -->
  <g class="text-white">
    <line
      x1={xScale(cliffDurationMs)}
      y1={margin.top}
      x2={xScale(cliffDurationMs)}
      y2={height - margin.bottom}
      stroke="currentColor"
      stroke-width={strokeWidth}
      stroke-dasharray="5,5"
    />
    <text
      x={xScale(cliffDurationMs)}
      y={margin.top - 5}
      text-anchor={xScale(cliffDurationMs) < width * 0.1 ? "start" : "middle"}
      font-size={fontSize}
      fill="currentColor">Cliff & Vesting end</text
    >
    <text
      x={xScale(cliffDurationMs)}
      y={height - margin.bottom + height * 0.067}
      text-anchor={xScale(cliffDurationMs) < width * 0.1 ? "start" : "middle"}
      font-size={fontSize}
      fill="currentColor">{Math.round(cliffDurationMs / MS_PER_DAY)}d</text
    >
  </g>
{:else}
  <!-- Cliff line and label -->
  {#if cliffDurationMs !== 0}
    <g class="text-white">
      <line
        x1={xScale(cliffDurationMs)}
        y1={margin.top}
        x2={xScale(cliffDurationMs)}
        y2={height - margin.bottom}
        stroke="currentColor"
        stroke-width={strokeWidth}
        stroke-dasharray="5,5"
      />
      <text
        x={xScale(cliffDurationMs)}
        y={margin.top - 5}
        text-anchor={xScale(cliffDurationMs) < width * 0.1 ? "start" : "middle"}
        font-size={fontSize}
        fill="currentColor">Cliff end</text
      >
      <text
        x={xScale(cliffDurationMs)}
        y={height - margin.bottom + height * 0.067}
        text-anchor={xScale(cliffDurationMs) < width * 0.1 ? "start" : "middle"}
        font-size={fontSize}
        fill="currentColor">{Math.round(cliffDurationMs / MS_PER_DAY)}d</text
      >
    </g>
  {/if}

  <!-- Vesting end line and label -->
  <g class="text-white">
    <line
      x1={xScale(totalDurationMs)}
      y1={margin.top}
      x2={xScale(totalDurationMs)}
      y2={height - margin.bottom}
      stroke="currentColor"
      stroke-width={strokeWidth}
      stroke-dasharray="5,5"
    />
    <text
      x={xScale(totalDurationMs)}
      y={margin.top - 5}
      text-anchor="middle"
      font-size={fontSize}
      fill="currentColor">Vesting end</text
    >
    <text
      x={xScale(totalDurationMs)}
      y={height - margin.bottom + height * 0.067}
      text-anchor="middle"
      font-size={fontSize}
      fill="currentColor">{Math.round(totalDurationMs / MS_PER_DAY)}d</text
    >
  </g>
{/if}
