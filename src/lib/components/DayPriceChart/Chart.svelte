<script lang="ts">
  import { curveCatmullRom, line, max, min, scaleLinear } from "d3";
  import { createEventDispatcher } from "svelte";

  import Line from "./Line.svelte";

  const HOURS = 1000 * 60 * 60;

  export let width: number;
  export let height: number;

  export let data: { x: number; y: number }[] = [];

  const margin = {
    top: 20,
    right: 0,
    bottom: 10,
    left: 0,
  };

  const initialXDomain = [0, 26 * HOURS];
  const initialYDomain = [0, 1];

  $: X = scaleLinear()
    .domain(
      data.length
        ? [min(data, (d) => d.x)!, min(data, (d) => d.x)! + 26 * HOURS]
        : initialXDomain,
    )
    .range([margin.left, width - margin.right]);

  $: Y = scaleLinear()
    .domain(
      data.length
        ? [min(data, (d) => d.y)! * 0.99, max(data, (d) => d.y)!]
        : initialYDomain,
    )
    .range([height - margin.bottom, margin.top]);

  $: lineFn = line<{ x: number; y: number }>()
    .x((d) => X(d.x))
    .y((d) => Y(d.y))
    .curve(curveCatmullRom);

  $: XTicks = (() => {
    const min = X.domain()[0];
    return [min, min + 6 * HOURS, min + 12 * HOURS, min + 18 * HOURS];
  })();

  const dispatch = createEventDispatcher();

  let selected: (typeof data)[number] | null;

  function handleMove(xPosition: number) {
    if (!data.length) return;
    const closestData = data.reduce((prev, curr) => {
      return Math.abs(X(curr.x) - xPosition) < Math.abs(X(prev.x) - xPosition)
        ? curr
        : prev;
    });

    const hoursAgo = Math.floor(
      (X.domain()[0] + 24 * HOURS - closestData.x) / 1000 / 60 / 60,
    );

    if (hoursAgo > 0) {
      dispatch("hover", {
        price: closestData.y,
        hoursAgo,
      });
      selected = closestData;
    } else {
      dispatch("hover", null);
      selected = null;
    }
  }

  function handleMouseMove(event: MouseEvent) {
    if (
      event &&
      "target" in event &&
      event.target instanceof SVGElement &&
      event.target.role === "img"
    ) {
      const mouseX = event.clientX - event.target.getBoundingClientRect().left;
      handleMove(mouseX);
    }
  }

  function handleTouchMove(event: TouchEvent) {
    event.preventDefault();
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      if (
        touch &&
        "target" in touch &&
        touch.target instanceof SVGElement &&
        touch.target.role === "img"
      ) {
        const mouseX =
          touch.clientX - touch.target.getBoundingClientRect().left;
        handleMove(mouseX);
      }
    }
  }
</script>

<svg
  {width}
  {height}
  class="w-full h-full text-lime cursor-pointer"
  on:mousemove={handleMouseMove}
  on:mouseleave={() => {
    dispatch("hover", null);
    selected = null;
  }}
  on:touchmove={handleTouchMove}
  on:touchend={() => {
    dispatch("hover", null);
    selected = null;
  }}
  role="img"
>
  {#if data.length}
    <Line
      d={lineFn(data)}
      cx={X(data[data.length - 1].x)}
      cy={Y(data[data.length - 1].y)}
    />
  {/if}

  <!-- X axis -->
  {#each XTicks as tick, i}
    <text
      x={X(tick)}
      y={height - margin.bottom}
      font-size="3"
      fill="currentColor"
      text-anchor={i !== 0 ? "middle" : "start"}
    >
      -{Math.floor((X.domain()[0] + 24 * HOURS - tick) / 1000 / 60 / 60)}h
    </text>
  {/each}
  <text
    x={data.length ? X(data[data.length - 1].x) : X(24 * HOURS)}
    y={height - margin.bottom}
    font-size="3"
    fill="currentColor"
    text-anchor="middle"
  >
    now
  </text>

  <!-- Vertical dotted line on closest Data -->
  {#if selected}
    <line
      x1={X(selected.x)}
      y1={height - margin.bottom}
      x2={X(selected.x)}
      y2={margin.top}
      stroke="white/50"
      stroke-dasharray="2"
    />
  {/if}
</svg>
