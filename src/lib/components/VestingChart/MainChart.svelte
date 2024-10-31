<script lang="ts">
  import AxisAndLabel from "./AxisAndLabel.svelte";
  import ChartLegend from "./ChartLegend.svelte";
  import LineArea from "./LineArea.svelte";
  import Svg from "./SVG.svelte";
  import VestingChartTooltip from "./VestingChartTooltip.svelte";
  import {
    calculateVestingData,
    MS_PER_DAY,
    AUCTION_DURATION_MS,
  } from "./utils";

  export let teamAllocation: {
    allocationBps: number;
    vestingDurationMs: number;
    cliffDurationMs: number;
  };

  // // If claimed is provided, add a line to the chart at the time of claimed
  // // time of claimed is calculated as vesting start time + claimed / total allocation
  // export let claimed: bigint | undefined = undefined;

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
    teamAllocation.vestingDurationMs,
    teamAllocation.cliffDurationMs,
    allocationPercentage,
    displayDurationMs,
    liquidityPoolPercentage,
    depositorPercentage,
    circulatingSupplyPercentage,
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

  $: fontSize = Math.min(width, height) * 0.03;
  $: strokeWidth = Math.min(width, height) * 0.005;

  let selected: (typeof data)[number] | null = null;

  function handleMove(xPosition: number | null) {
    if (typeof xPosition !== "number") {
      selected = null;
      return;
    }
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

    // Only dispatch and update selected if within chart bounds
    if (xPosition >= margin.left && xPosition <= width - margin.right) {
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
      selected = null;
    }
  }
</script>

<div bind:this={container} class="w-full">
  <Svg
    {width}
    {height}
    class="bg-gray-700 rounded-lg border border-white"
    on:mouseX={({ detail: mouseX }) => handleMove(mouseX)}
  >
    <ChartLegend {selected} {margin} {width} {fontSize} />

    {#if pathD}
      <!-- Depositor auction -->
      <LineArea
        pathD={depositorAuctionPathD}
        areaPathD={depositorAuctionAreaPathD}
        {strokeWidth}
        color="#2196F3"
      />

      <!-- Depositor post-auction -->
      <LineArea
        pathD={depositorPostAuctionPathD}
        areaPathD={depositorPostAuctionAreaPathD}
        {strokeWidth}
        color="#00f0f0"
      />

      <!-- Liquidity pool -->
      <LineArea
        pathD={liquidityAuctionPathD}
        areaPathD={liquidityAuctionAreaPathD}
        {strokeWidth}
        color="#4CAF50"
      />

      <!-- Team allocation -->
      <LineArea
        {pathD}
        areaPathD={teamAreaPathD}
        {strokeWidth}
        color="#a3e635"
        class="text-lime-400"
        gradientId="areaGradient"
      />
    {/if}

    <AxisAndLabel
      {width}
      {height}
      {margin}
      {fontSize}
      {strokeWidth}
      {totalDurationMs}
      {cliffDurationMs}
      {MS_PER_DAY}
      {xScale}
    />

    <VestingChartTooltip
      {selected}
      {xScale}
      {yScale}
      {height}
      {margin}
      {strokeWidth}
    />
  </Svg>
</div>
