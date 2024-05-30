<script lang="ts">
  import { curveCatmullRom, extent, line, scaleLinear } from "d3";

  export let width: number;
  export let height: number;

  export let data: { x: number; y: number }[] = [];

  const margin = {
    top: 20,
    right: 0,
    bottom: 20,
    left: 0,
  };

  $: X = scaleLinear()
    .domain(extent(data, (d) => d.x) as [number, number])
    .range([margin.left, width - margin.right]);

  $: Y = scaleLinear()
    .domain(extent(data, (d) => d.y) as [number, number])
    .range([height - margin.bottom, margin.top]);

  $: lineFn = line<{ x: number; y: number }>()
    .x((d) => X(d.x))
    .y((d) => Y(d.y))
    .curve(curveCatmullRom);
</script>

<svg {width} {height} class="w-full h-full text-white">
  <path d={lineFn(data)} fill="none" stroke="lime" stroke-width="2" />
</svg>
