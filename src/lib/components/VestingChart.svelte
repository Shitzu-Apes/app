<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let teamAllocation: {
    allocationBps: number;
    vestingDurationMs: number;
    cliffDurationMs: number;
  };

  let width = 400;
  let height = 300;
  let margin = {
    top: height * 0.1,
    right: width * 0.05,
    bottom: height * 0.1,
    left: width * 0.05,
  };

  $: totalDurationMs = teamAllocation.vestingDurationMs;
  $: cliffDurationMs = teamAllocation.cliffDurationMs;
  $: allocationPercentage = teamAllocation.allocationBps / 10000; // Convert bps to percentage

  $: data = calculateVestingData(
    totalDurationMs,
    cliffDurationMs,
    allocationPercentage,
  );
  $: xScale = (x: number) =>
    (x / totalDurationMs) * (width - margin.left - margin.right) +
      margin.left || 0;
  $: yScale = (y: number) =>
    height -
      margin.bottom -
      (y / allocationPercentage) * (height - margin.top - margin.bottom) || 0;

  function calculateVestingData(
    totalDurationMs: number,
    cliffDurationMs: number,
    allocationPercentage: number,
  ) {
    if (!totalDurationMs || !allocationPercentage) {
      return [];
    }

    const totalPoints = 100;

    return Array.from({ length: totalPoints + 1 }, (_, i) => {
      const time = (i / totalPoints) * totalDurationMs;

      let vested = 0;
      if (time > cliffDurationMs) {
        vested = Math.min(
          ((time - cliffDurationMs) / (totalDurationMs - cliffDurationMs)) *
            allocationPercentage,
          allocationPercentage,
        );
      }

      return { time, vested };
    });
  }

  $: pathD =
    data.length > 0
      ? data
          .map(
            (d, i) =>
              `${i === 0 ? "M" : "L"} ${xScale(d.time)} ${yScale(d.vested)}`,
          )
          .join(" ")
      : "";

  $: areaPathD =
    data.length > 0
      ? pathD +
        ` L ${xScale(totalDurationMs)} ${height - margin.bottom} L ${
          margin.left
        } ${height - margin.bottom} Z`
      : "";

  $: yAxisTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: yScale(t * allocationPercentage),
    label: `${(t * allocationPercentage * 100).toFixed(2)}%`,
  }));

  $: fontSize = Math.min(width, height) * 0.03;
  $: strokeWidth = Math.min(width, height) * 0.005;

  const dispatch = createEventDispatcher();
  let selected: (typeof data)[number] | null = null;

  function handleMove(xPosition: number) {
    if (!data.length) return;

    // Calculate exact time from x position
    const time = Math.max(
      0,
      Math.min(
        totalDurationMs,
        ((xPosition - margin.left) / (width - margin.left - margin.right)) *
          totalDurationMs,
      ),
    );

    // Calculate vested amount at this time
    let vested = 0;
    if (time > cliffDurationMs) {
      vested = Math.min(
        ((time - cliffDurationMs) / (totalDurationMs - cliffDurationMs)) *
          allocationPercentage,
        allocationPercentage,
      );
    }

    const hoursFromStart = Math.floor(time / (60 * 60 * 1000));

    // Only dispatch and update selected if within chart bounds
    if (xPosition >= margin.left && xPosition <= width - margin.right) {
      dispatch("hover", {
        vested,
        hoursFromStart,
      });
      selected = { time, vested };
    } else {
      dispatch("hover", null);
      selected = null;
    }
  }

  function handleMouseMove(event: MouseEvent) {
    const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    handleMove(mouseX);
  }

  function handleTouchMove(event: TouchEvent) {
    event.preventDefault();
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
      const mouseX = touch.clientX - rect.left;
      handleMove(mouseX);
    }
  }
</script>

<svg
  {width}
  {height}
  class="bg-gray-700 rounded-lg border border-white"
  on:mousemove={handleMouseMove}
  on:mouseleave={() => {
    dispatch("hover", null);
    selected = null;
  }}
  on:touchstart={handleTouchMove}
  on:touchmove={handleTouchMove}
  on:touchend={() => {
    dispatch("hover", null);
    selected = null;
  }}
  role="img"
>
  <defs class="text-shitzu-4">
    <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="currentColor" stop-opacity="1" />
      <stop offset="100%" stop-color="currentColor" stop-opacity="0" />
    </linearGradient>
  </defs>

  {#if pathD}
    <path d={areaPathD} fill="url(#areaGradient)" />
    <path
      class="text-shitzu-4"
      d={pathD}
      fill="none"
      stroke="currentColor"
      stroke-width={strokeWidth}
    />
  {/if}

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
        x={margin.left}
        y={tick.y - 5}
        text-anchor="start"
        font-size={fontSize}
        fill="#FFFFFF">{tick.label}</text
      >
    {/each}
  </g>

  <!-- Cliff line and label -->
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
      text-anchor="middle"
      font-size={fontSize}
      fill="currentColor">Cliff end</text
    >
    <text
      x={xScale(cliffDurationMs)}
      y={height - margin.bottom + height * 0.067}
      text-anchor="middle"
      font-size={fontSize}
      fill="currentColor"
      >{Math.round(cliffDurationMs / (24 * 60 * 60 * 1000))}d</text
    >
  </g>

  <!-- Vesting end label -->
  <text
    x={width - margin.right}
    y={height - margin.bottom + height * 0.067}
    text-anchor="middle"
    font-size={fontSize}
    fill="#FFFFFF">{Math.round(totalDurationMs / (24 * 60 * 60 * 1000))}d</text
  >

  <!-- Tooltip vertical line -->
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
      cy={yScale(selected.vested)}
      r={3}
      fill="white"
    />
  {/if}
</svg>
