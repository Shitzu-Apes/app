<script lang="ts">
  import { createEventDispatcher } from "svelte";

  import { readableDuration } from "$lib/util/timesAgo";

  export let teamAllocation: {
    allocationBps: number;
    vestingDurationMs: number;
    cliffDurationMs: number;
  };

  let width = 400;
  let height = 300;
  let margin = {
    top: height * 0.15, // Increased top margin
    right: width * 0.05,
    bottom: height * 0.1,
    left: width * 0.05,
  };

  const delta = 1 / 1.98;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  $: totalDurationMs = teamAllocation.vestingDurationMs;
  $: cliffDurationMs = teamAllocation.cliffDurationMs;
  $: displayDurationMs =
    totalDurationMs === 0 && cliffDurationMs === 0
      ? MS_PER_DAY // Show 1 day if instant allocation
      : totalDurationMs + MS_PER_DAY; // Add 1 day to show final state
  $: allocationPercentage = teamAllocation.allocationBps / 10000; // Convert bps to percentage
  $: liquidityPoolPercentage = (100 - allocationPercentage * 100) * delta;
  $: depositorPercentage = (100 - allocationPercentage * 100) * (1 - delta);

  $: data = calculateVestingData(
    totalDurationMs,
    cliffDurationMs,
    allocationPercentage,
  );
  $: xScale = (x: number) =>
    (x / displayDurationMs) * (width - margin.left - margin.right) +
      margin.left || 0;
  $: yScale = (y: number) =>
    height -
      margin.bottom -
      (y / 100) * (height - margin.top - margin.bottom) || 0;

  function calculateVestingData(
    totalDurationMs: number,
    cliffDurationMs: number,
    allocationPercentage: number,
  ) {
    if (!allocationPercentage) {
      return [];
    }

    const isInstant = totalDurationMs === 0 && cliffDurationMs === 0;

    // Create data points at key breakpoints
    const points = [];

    if (isInstant) {
      // For instant vesting, add start and end points with full allocation
      points.push({
        time: 0,
        vested: allocationPercentage * 100,
        liquidityPool: allocationPercentage * 100 + liquidityPoolPercentage,
        depositor:
          allocationPercentage * 100 +
          liquidityPoolPercentage +
          depositorPercentage,
      });

      points.push({
        time: displayDurationMs,
        vested: allocationPercentage * 100,
        liquidityPool: allocationPercentage * 100 + liquidityPoolPercentage,
        depositor:
          allocationPercentage * 100 +
          liquidityPoolPercentage +
          depositorPercentage,
      });
    } else {
      // Start point
      points.push({
        time: 0,
        vested: 0,
        liquidityPool: liquidityPoolPercentage,
        depositor: liquidityPoolPercentage + depositorPercentage,
      });

      // Add cliff point if there is a cliff
      if (cliffDurationMs > 0) {
        points.push({
          time: cliffDurationMs,
          vested: 0,
          liquidityPool: liquidityPoolPercentage,
          depositor: liquidityPoolPercentage + depositorPercentage,
        });
      }

      // Add vesting end point
      points.push({
        time: totalDurationMs,
        vested: allocationPercentage * 100,
        liquidityPool: allocationPercentage * 100 + liquidityPoolPercentage,
        depositor:
          allocationPercentage * 100 +
          liquidityPoolPercentage +
          depositorPercentage,
      });

      // Add display end point
      points.push({
        time: displayDurationMs,
        vested: allocationPercentage * 100,
        liquidityPool: allocationPercentage * 100 + liquidityPoolPercentage,
        depositor:
          allocationPercentage * 100 +
          liquidityPoolPercentage +
          depositorPercentage,
      });
    }

    return points;
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

  $: liquidityPathD =
    data.length > 0
      ? data
          .map(
            (d, i) =>
              `${i === 0 ? "M" : "L"} ${xScale(d.time)} ${yScale(d.liquidityPool)}`,
          )
          .join(" ")
      : "";

  $: depositorPathD =
    data.length > 0
      ? data
          .map(
            (d, i) =>
              `${i === 0 ? "M" : "L"} ${xScale(d.time)} ${yScale(d.depositor)}`,
          )
          .join(" ")
      : "";

  $: depositorAreaPathD =
    data.length > 0
      ? depositorPathD +
        ` L ${xScale(displayDurationMs)} ${height - margin.bottom} L ${
          margin.left
        } ${height - margin.bottom} Z`
      : "";

  $: liquidityAreaPathD =
    data.length > 0
      ? liquidityPathD +
        ` L ${xScale(displayDurationMs)} ${height - margin.bottom} L ${
          margin.left
        } ${height - margin.bottom} Z`
      : "";

  $: teamAreaPathD =
    data.length > 0
      ? pathD +
        ` L ${xScale(displayDurationMs)} ${height - margin.bottom} L ${
          margin.left
        } ${height - margin.bottom} Z`
      : "";

  $: yAxisTicks = [0, 25, 50, 75, 100].map((t) => ({
    y: yScale(t),
    label: `${t}%`,
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
        displayDurationMs,
        ((xPosition - margin.left) / (width - margin.left - margin.right)) *
          displayDurationMs,
      ),
    );

    // Calculate vested amount at this time
    let vested = 0;
    if (totalDurationMs === 0 && cliffDurationMs === 0) {
      vested = allocationPercentage * 100;
    } else if (time > cliffDurationMs) {
      vested = Math.min(
        ((time - cliffDurationMs) / (totalDurationMs - cliffDurationMs)) *
          allocationPercentage *
          100,
        allocationPercentage * 100,
      );
    }

    const hoursFromStart = Math.floor(time / (60 * 60 * 1000));

    // Only dispatch and update selected if within chart bounds
    if (xPosition >= margin.left && xPosition <= width - margin.right) {
      dispatch("hover", {
        vested,
        hoursFromStart,
      });
      selected = {
        time,
        vested,
        liquidityPool: vested + liquidityPoolPercentage,
        depositor: vested + liquidityPoolPercentage + depositorPercentage,
      };
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
  <defs>
    <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="currentColor" stop-opacity="0.3" />
      <stop offset="100%" stop-color="currentColor" stop-opacity="0.1" />
    </linearGradient>
  </defs>

  <!-- Legend (moved to top) -->
  <g transform="translate({margin.left}, {margin.top * 0.5})">
    <text x={0} y="0" fill="currentColor" font-size={fontSize}>
      Time {selected ? readableDuration(selected.time, 2) : ""}
    </text>
    <text x={width * 0.25} y="0" fill="currentColor" font-size={fontSize}>
      Team {selected ? selected.vested.toFixed(1) + "%" : ""}
    </text>
    <text x={width * 0.5} y="0" fill="#4CAF50" font-size={fontSize}>
      Ref {selected
        ? (selected.liquidityPool - selected.vested).toFixed(1) + "%"
        : ""}
    </text>
    <text x={width * 0.75} y="0" fill="#2196F3" font-size={fontSize}>
      Depositor {selected
        ? (selected.depositor - selected.liquidityPool).toFixed(1) + "%"
        : ""}
    </text>
  </g>

  {#if pathD}
    <!-- Depositor area -->
    <path d={depositorAreaPathD} fill="#2196F3" fill-opacity="0.2" />
    <path
      d={depositorPathD}
      fill="none"
      stroke="#2196F3"
      stroke-width={strokeWidth}
      stroke-dasharray="5,5"
    />

    <!-- Liquidity pool area -->
    <path d={liquidityAreaPathD} fill="#4CAF50" fill-opacity="0.2" />
    <path
      d={liquidityPathD}
      fill="none"
      stroke="#4CAF50"
      stroke-width={strokeWidth}
      stroke-dasharray="5,5"
    />

    <!-- Team allocation area -->
    <path d={teamAreaPathD} class="text-shitzu-4" fill="url(#areaGradient)" />
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
        x={width - margin.right}
        y={tick.y - 5}
        text-anchor="end"
        font-size={fontSize}
        fill-opacity="0.5"
        fill="#FFFFFF">{tick.label}</text
      >
    {/each}
  </g>
  <!-- Cliff/Vesting line and label -->
  {#if cliffDurationMs === totalDurationMs}
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
      cy={yScale(selected.depositor)}
      r={3}
      fill="#2196F3"
    />
    <circle
      cx={xScale(selected.time)}
      cy={yScale(selected.liquidityPool)}
      r={3}
      fill="#4CAF50"
    />
    <circle
      cx={xScale(selected.time)}
      cy={yScale(selected.vested)}
      r={3}
      fill="white"
    />
  {/if}
</svg>
