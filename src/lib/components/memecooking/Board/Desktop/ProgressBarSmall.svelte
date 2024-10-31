<script lang="ts">
  import { arc } from "d3-shape";
  import { onMount } from "svelte";

  import type { Meme } from "$lib/api/client";
  import ExtraDetail from "$lib/components/ExtraDetail.svelte";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import { createProgressBarData } from "$lib/util/progressBarLogic";

  export let meme: Meme;

  let container: HTMLDivElement;
  let width: number;
  let height: number;
  let innerRadius: number;
  let outerRadius: number;

  onMount(() => {
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
  });

  function updateDimensions() {
    width = container?.clientWidth;
    height = width / 2; // Half of the width for half-circle
    innerRadius = width * 0.25;
    outerRadius = width * 0.5;
  }

  let { hardCap, softcapProgress, hardCapProgress, softHardCapRatio } =
    createProgressBarData(meme);

  $: {
    ({ hardCap, softcapProgress, hardCapProgress, softHardCapRatio } =
      createProgressBarData(meme));
  }

  const gapAngle = 0.02; // Gap angle in radians

  // Calculate angles in radians
  const startAngle = -Math.PI / 2;
  const softCapAngle = Math.PI * softHardCapRatio;
  const hardCapAngle = Math.PI * (1 - softHardCapRatio);

  $: softCapProgressAngle =
    startAngle + softCapAngle * Math.min(softcapProgress, 1);
  $: softCapEndAngle = startAngle + softCapAngle - gapAngle;
  $: hardCapStartAngle = startAngle + softCapAngle + gapAngle;
  $: hardCapProgressAngle = hardCapStartAngle + hardCapAngle * hardCapProgress;
  $: hardCapEndAngle = hardCapStartAngle + hardCapAngle;
  $: singleArcEndAngle = startAngle + Math.PI * softcapProgress;

  // Arc paths
  $: backgroundArcPath = arc()({
    innerRadius,
    outerRadius,
    startAngle: -Math.PI / 2,
    endAngle: Math.PI / 2,
  });

  $: softCapArcPath = arc()({
    innerRadius,
    outerRadius,
    startAngle: -Math.PI / 2,
    endAngle: softCapEndAngle,
  });

  $: softCapProgressArcPath = arc()({
    innerRadius,
    outerRadius,
    startAngle: -Math.PI / 2,
    endAngle: softCapProgressAngle,
  });

  $: hardCapProgressArcPath = arc()({
    innerRadius,
    outerRadius,
    startAngle: hardCapStartAngle,
    endAngle: hardCapProgressAngle,
  });

  $: hardCapArcPath = arc()({
    innerRadius,
    outerRadius,
    startAngle: hardCapStartAngle,
    endAngle: hardCapEndAngle,
  });

  $: singleArcPath = arc()({
    innerRadius,
    outerRadius,
    startAngle: -Math.PI / 2,
    endAngle: singleArcEndAngle,
  });
</script>

<Tooltip class="w-full">
  <slot slot="info">
    <ExtraDetail class="w-80 p-2 text-sm" {meme} />
  </slot>

  <div bind:this={container} class="w-full h-full">
    <svg {width} {height} viewBox="-{width * 0.1} 0 {width * 1.2} {height}">
      <defs>
        <linearGradient id="softCapGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#FF0000;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#FF6347;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="hardCapGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#32CD32;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#00FF00;stop-opacity:1" />
        </linearGradient>
      </defs>
      {#if hardCap}
        <g transform="translate({width / 2}, {height})">
          <!-- Soft cap border -->
          <path
            d={softCapArcPath}
            stroke={softcapProgress < 1 ? "#FF0000" : "#32CD32"}
            fill="rgba(224, 224, 224, 1)"
            stroke-width="1.5"
          />
          <!-- Soft cap progress arc -->
          <path
            d={softCapProgressArcPath}
            fill={softcapProgress < 1 ? "url(#softCapGradient)" : "#32CD32"}
          />

          <!-- Hard cap border -->
          <path
            d={hardCapArcPath}
            stroke={hardCapProgress > 0 ? "#32CD32" : "#FF0000"}
            fill="rgba(224, 224, 224, 1)"
            stroke-width="1.5"
          />
          <!-- Hard cap progress arc -->
          {#if hardCapProgress > 0}
            <path d={hardCapProgressArcPath} fill="url(#hardCapGradient)" />
          {/if}
        </g>
      {:else}
        <g transform="translate({width / 2}, {height})">
          <!-- Background arc -->
          <path
            d={backgroundArcPath}
            fill="#E0E0E0"
            stroke="#B0B0B0"
            stroke-width="1.5"
          />

          <!-- Progress arc -->
          <path
            d={singleArcPath}
            fill={softcapProgress < 1 ? "url(#softCapGradient)" : "#32CD32"}
          />
        </g>
      {/if}
    </svg>
  </div>
</Tooltip>
