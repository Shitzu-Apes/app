<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export let width: number;
  export let height: number;
  let className: string;
  export { className as class };

  const dispatch = createEventDispatcher<{
    mouseX: number | null;
  }>();

  function handleMouseMove(event: MouseEvent) {
    const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    dispatch("mouseX", mouseX);
  }

  function handleTouchMove(event: TouchEvent) {
    event.preventDefault();
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
      const mouseX = touch.clientX - rect.left;
      dispatch("mouseX", mouseX);
    }
  }

  function handleLeave() {
    dispatch("mouseX", null);
  }
</script>

<svg
  {width}
  {height}
  class={className}
  on:mousemove={handleMouseMove}
  on:mouseleave={handleLeave}
  on:touchstart={handleTouchMove}
  on:touchmove={handleTouchMove}
  on:touchend={handleLeave}
  role="img"
>
  <slot />
</svg>
