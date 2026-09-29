<script lang="ts">
  import { afterUpdate } from "svelte";

  export let d: string | null;
  export let cx: number;
  export let cy: number;

  let ref: SVGPathElement | null = null;

  let length = 0;

  afterUpdate(() => {
    length = ref?.getTotalLength() || 0;
  });
</script>

<path
  bind:this={ref}
  {d}
  fill="none"
  stroke="lime"
  stroke-width="2"
  stroke-dasharray={length}
  stroke-dashoffset={length}
/>
<circle
  id="pulse-circle"
  {cx}
  {cy}
  r="10"
  fill="lime"
  fill-opacity="25%"
  opacity="0%"
/>
<circle id="main-circle" {cx} {cy} r="3" fill="lime" opacity="0%" />

<style scoped>
  path {
    /* dash 5s linear forwards with 3s delay */
    animation: dash 2.5s linear forwards;
  }

  @keyframes dash {
    to {
      stroke-dashoffset: 0;
    }
  }

  #main-circle {
    animation: show 0.5s linear forwards 2.5s;
  }

  @keyframes show {
    to {
      opacity: 100%;
    }
  }

  #pulse-circle {
    animation: circlePulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite 2.5s;
  }

  @keyframes circlePulse {
    0% {
      opacity: 100%;
    }
    70% {
      opacity: 50%;
    }
    100% {
      opacity: 100%;
    }
  }
</style>
