<script lang="ts">
  import { createEventDispatcher } from "svelte";

  import { readableDuration } from "$lib/util/timesAgo";

  export let teamAllocation: {
    allocationBps: number;
    vestingDurationMs: number;
    cliffDurationMs: number;
  };

  let container: HTMLDivElement;
  let width: number;
  let height: number;
  $: width = container?.clientWidth || 400;
  $: height = width * 0.75; // Keep 4:3 aspect ratio

  $: margin = {
    top: height * 0.15, // Increased top margin
    right: width * 0.05,
    bottom: height * 0.1,
    left: width * 0.05,
  };

  const delta = 1 / 1.98;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const AUCTION_DURATION_MS = 1 * MS_PER_DAY; // 7 days auction period
  $: POST_VESTING_WIDTH_MS =
    0.2 * (teamAllocation.vestingDurationMs + teamAllocation.cliffDurationMs); // based on 0.15 of cliff + vesting

  $: totalDurationMs =
    teamAllocation.cliffDurationMs + teamAllocation.vestingDurationMs;
  $: cliffDurationMs = teamAllocation.cliffDurationMs;
  $: displayDurationMs =
    totalDurationMs === 0 && cliffDurationMs === 0
      ? MS_PER_DAY // Show 1 day if instant allocation
      : totalDurationMs + POST_VESTING_WIDTH_MS; // Add 1 day to show final state
  $: allocationPercentage = teamAllocation.allocationBps / 10000; // Convert bps to percentage
  $: liquidityPoolPercentage = (100 - allocationPercentage * 100) * delta;
  $: depositorPercentage = (100 - allocationPercentage * 100) * (1 - delta);
  $: circulatingSupplyPercentage =
    depositorPercentage + liquidityPoolPercentage;

  $: data = calculateVestingData(
    totalDurationMs,
    cliffDurationMs,
    allocationPercentage,
  );

  // Adjust xScale to account for auction period
  $: xScale = (x: number) => {
    const chartWidth = width - margin.left - margin.right;
    const auctionWidth = chartWidth * 0.2; // 20% of width for auction
    const vestingWidth = chartWidth * 0.8; // 80% of width for vesting

    if (x < 0) {
      // Auction period
      return (
        margin.left +
        ((x + AUCTION_DURATION_MS) / AUCTION_DURATION_MS) * auctionWidth
      );
    } else {
      // Vesting period
      return (
        margin.left + auctionWidth + (x / displayDurationMs) * vestingWidth
      );
    }
  };

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

    // Add auction start point
    points.push({
      time: -AUCTION_DURATION_MS,
      vested: 0,
      liquidityPool: liquidityPoolPercentage,
      depositor: liquidityPoolPercentage + depositorPercentage,
      circulatingSupply: circulatingSupplyPercentage,
    });

    if (isInstant) {
      // For instant vesting, add start and end points with full allocation
      points.push({
        time: 0,
        vested: 0,
        liquidityPool: liquidityPoolPercentage,
        depositor: liquidityPoolPercentage + depositorPercentage,
        circulatingSupply: circulatingSupplyPercentage,
      });

      points.push({
        time: 0,
        vested: allocationPercentage * 100,
        liquidityPool: allocationPercentage * 100 + liquidityPoolPercentage,
        depositor:
          allocationPercentage * 100 +
          liquidityPoolPercentage +
          depositorPercentage,
        circulatingSupply: circulatingSupplyPercentage,
      });

      points.push({
        time: displayDurationMs,
        vested: allocationPercentage * 100,
        liquidityPool: allocationPercentage * 100 + liquidityPoolPercentage,
        depositor:
          allocationPercentage * 100 +
          liquidityPoolPercentage +
          depositorPercentage,
        circulatingSupply: circulatingSupplyPercentage,
      });
    } else {
      // Start point at auction end
      points.push({
        time: 0,
        vested: 0,
        liquidityPool: liquidityPoolPercentage,
        depositor: liquidityPoolPercentage + depositorPercentage,
        circulatingSupply: circulatingSupplyPercentage,
      });

      // Add cliff point if there is a cliff
      if (cliffDurationMs > 0) {
        points.push({
          time: cliffDurationMs,
          vested: 0,
          liquidityPool: liquidityPoolPercentage,
          depositor: liquidityPoolPercentage + depositorPercentage,
          circulatingSupply: circulatingSupplyPercentage,
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
        circulatingSupply: circulatingSupplyPercentage,
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
        circulatingSupply: circulatingSupplyPercentage,
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

  // Split paths into auction and post-auction segments
  $: auctionData = data.filter((d) => d.time <= 0);
  $: postAuctionData = data.filter((d) => d.time >= 0);

  $: depositorAuctionPathD =
    auctionData.length > 0
      ? auctionData
          .map(
            (d, i) =>
              `${i === 0 ? "M" : "L"} ${xScale(d.time)} ${yScale(d.depositor)}`,
          )
          .join(" ")
      : "";

  $: depositorPostAuctionPathD =
    postAuctionData.length > 0
      ? postAuctionData
          .map(
            (d, i) =>
              `${i === 0 ? "M" : "L"} ${xScale(d.time)} ${yScale(d.circulatingSupply + d.vested)}`,
          )
          .join(" ")
      : "";

  $: liquidityAuctionPathD =
    auctionData.length > 0
      ? auctionData
          .map(
            (d, i) =>
              `${i === 0 ? "M" : "L"} ${xScale(d.time)} ${yScale(d.liquidityPool)}`,
          )
          .join(" ")
      : "";

  $: depositorAuctionAreaPathD =
    auctionData.length > 0
      ? depositorAuctionPathD +
        ` L ${xScale(0)} ${height - margin.bottom} L ${margin.left} ${
          height - margin.bottom
        } Z`
      : "";

  $: depositorPostAuctionAreaPathD =
    postAuctionData.length > 0
      ? depositorPostAuctionPathD +
        ` L ${xScale(displayDurationMs)} ${height - margin.bottom} L ${xScale(
          0,
        )} ${height - margin.bottom} Z`
      : "";

  $: liquidityAuctionAreaPathD =
    auctionData.length > 0
      ? liquidityAuctionPathD +
        ` L ${xScale(0)} ${height - margin.bottom} L ${margin.left} ${
          height - margin.bottom
        } Z`
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

    const chartWidth = width - margin.left - margin.right;
    const auctionWidth = chartWidth * 0.2;
    const vestingWidth = chartWidth * 0.8;
    const relativeX = xPosition - margin.left;

    let time: number;
    if (relativeX < auctionWidth) {
      // In auction period
      time =
        (relativeX / auctionWidth) * AUCTION_DURATION_MS - AUCTION_DURATION_MS;
    } else {
      // In vesting period
      time = ((relativeX - auctionWidth) / vestingWidth) * displayDurationMs;
    }

    time = Math.max(-AUCTION_DURATION_MS, Math.min(displayDurationMs, time));

    // Calculate vested amount at this time
    let vested = 0;
    if (time >= 0) {
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
    }

    const hoursFromStart = Math.floor(time / (60 * 60 * 1000));

    // Only dispatch and update selected if within chart bounds
    if (xPosition >= margin.left && xPosition <= width - margin.right) {
      dispatch("hover", {
        vested,
        hoursFromStart,
      });

      let liquidityPool = liquidityPoolPercentage;
      let depositor = liquidityPoolPercentage + depositorPercentage;
      let circulatingSupply = circulatingSupplyPercentage;

      if (time < 0) {
        // During auction
        liquidityPool = liquidityPoolPercentage;
        depositor = liquidityPoolPercentage + depositorPercentage;
        circulatingSupply = 0;
      } else {
        // After auction
        circulatingSupply = circulatingSupplyPercentage + vested;
      }

      selected = {
        time,
        vested,
        liquidityPool,
        depositor,
        circulatingSupply,
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

<div bind:this={container} class="w-full">
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
    <defs class="text-lime-400">
      <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="currentColor" stop-opacity="0.6" />
        <stop offset="100%" stop-color="currentColor" stop-opacity="0.3" />
      </linearGradient>
    </defs>

    <!-- Legend (moved to top) -->
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

    {#if pathD}
      <!-- Depositor areas -->
      <path d={depositorAuctionAreaPathD} fill="#2196F3" fill-opacity="0.2" />
      <path
        d={depositorPostAuctionAreaPathD}
        fill="#00f0f0"
        fill-opacity="0.2"
      />
      <!-- Split depositor path -->
      <path
        d={depositorAuctionPathD}
        fill="none"
        stroke="#2196F3"
        stroke-width={strokeWidth}
      />
      <path
        d={depositorPostAuctionPathD}
        fill="none"
        stroke="#00f0f0"
        stroke-width={strokeWidth}
      />

      <!-- Liquidity pool areas -->
      <path d={liquidityAuctionAreaPathD} fill="#4CAF50" fill-opacity="0.2" />
      <!-- Split liquidity path -->
      <path
        d={liquidityAuctionPathD}
        fill="none"
        stroke="#4CAF50"
        stroke-width={strokeWidth}
      />

      <!-- Team allocation area -->
      <path d={teamAreaPathD} class="text-lime-400" fill="url(#areaGradient)" />
      <path
        class="text-lime-400"
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
          text-anchor={xScale(cliffDurationMs) < width * 0.1
            ? "start"
            : "middle"}
          font-size={fontSize}
          fill="currentColor">Cliff & Vesting end</text
        >
        <text
          x={xScale(cliffDurationMs)}
          y={height - margin.bottom + height * 0.067}
          text-anchor={xScale(cliffDurationMs) < width * 0.1
            ? "start"
            : "middle"}
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
            text-anchor={xScale(cliffDurationMs) < width * 0.1
              ? "start"
              : "middle"}
            font-size={fontSize}
            fill="currentColor">Cliff end</text
          >
          <text
            x={xScale(cliffDurationMs)}
            y={height - margin.bottom + height * 0.067}
            text-anchor={xScale(cliffDurationMs) < width * 0.1
              ? "start"
              : "middle"}
            font-size={fontSize}
            fill="currentColor"
            >{Math.round(cliffDurationMs / MS_PER_DAY)}d</text
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
        cy={yScale(
          selected.time < 0 ? selected.depositor : selected.circulatingSupply,
        )}
        r={3}
        fill={selected.time < 0 ? "#2196F3" : "#00f0f0"}
      />
      <circle
        cx={xScale(selected.time)}
        cy={yScale(
          selected.time < 0
            ? selected.liquidityPool
            : selected.circulatingSupply,
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
  </svg>
</div>
