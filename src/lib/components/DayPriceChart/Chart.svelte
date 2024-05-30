<script lang="ts">
  import { curveCatmullRom, line, max, min, scaleLinear } from "d3";

  const HOURS = 1000 * 60 * 60;

  export let width: number;
  export let height: number;

  export let data: { x: number; y: number }[] = [];

  const margin = {
    top: 20,
    right: 0,
    bottom: 20,
    left: 0,
  };

  $: console.log(data.map((d) => new Date(d.x).toLocaleString()));

  $: X = scaleLinear()
    .domain([min(data, (d) => d.x)!, min(data, (d) => d.x)! + 26 * HOURS])
    .range([margin.left, width - margin.right]);

  $: Y = scaleLinear()
    .domain([min(data, (d) => d.y)! * 0.99, max(data, (d) => d.y)!])
    .range([height - margin.bottom, margin.top]);

  $: lineFn = line<{ x: number; y: number }>()
    .x((d) => X(d.x))
    .y((d) => Y(d.y))
    .curve(curveCatmullRom);

  $: XTicks = (() => {
    const min = X.domain()[0];
    return [min, min + 6 * HOURS, min + 12 * HOURS, min + 18 * HOURS];
  })();
</script>

<svg {width} {height} class="w-full h-full text-lime">
  <path d={lineFn(data)} fill="none" stroke="lime" stroke-width="2" />

  <!-- Pulsing at the current Price -->
  <circle
    cx={X(data[data.length - 1].x)}
    cy={Y(data[data.length - 1].y)}
    r="10"
    fill="lime"
    fill-opacity="25%"
    class="animate-pulse"
  />
  <circle
    cx={X(data[data.length - 1].x)}
    cy={Y(data[data.length - 1].y)}
    r="3"
    fill="lime"
  />

  <!-- X axis -->
  {#each XTicks as tick, i}
    <text
      x={X(tick)}
      y={height - margin.bottom}
      font-size="2"
      fill="currentColor"
      text-anchor={i !== 0 ? "middle" : "start"}
    >
      {Math.floor((X.domain()[0] + 24 * HOURS - tick) / 1000 / 60 / 60)}
    </text>
  {/each}
  <text
    x={X(data[data.length - 1].x)}
    y={height - margin.bottom}
    font-size="2"
    fill="currentColor"
    text-anchor="middle"
  >
    now
  </text>
  <text>
    <tspan
      x="50%"
      y={height - margin.bottom + 12}
      font-size="2"
      fill="currentColor"
      text-anchor="middle"
      alignment-baseline="baseline"
    >
      Hours Ago
    </tspan>
  </text>
</svg>
