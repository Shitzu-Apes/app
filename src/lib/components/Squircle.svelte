<script lang="ts">
  import { getSvgPath } from "figma-squircle";

  import SHITZU_FACE from "$lib/assets/logo/shitzu_face.svg";

  export let src: string | undefined = undefined;
  let className: string | undefined = undefined;
  export { className as class };

  let ready = false;
  export let stroke = true;

  const svgPath = getSvgPath({
    width: 200,
    height: 200,
    cornerRadius: 80,
    cornerSmoothing: 1,
  });
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="-10 -10 220 220"
  fill="none"
  stroke="currentColor"
  stroke-width={stroke ? 1 : 0}
  stroke-linecap="round"
  stroke-linejoin="round"
  width="200"
  height="200"
  class={className}
>
  {#if src}
    <image
      href={src}
      clip-path="path('{svgPath}')"
      width="200"
      height="200"
      class="{ready
        ? 'opacity-100'
        : 'opacity-0'} transition duration-200 ease-in-out"
      on:load={() => (ready = true)}
    />
  {/if}
  <path
    id="squircle"
    d={svgPath}
    stroke="currentColor"
    stroke-width={stroke ? 10 : 0}
    fill={src && ready ? "transparent" : "currentColor"}
    class="transition duration-200 ease-in-out"
  />
  <image
    x={10}
    y={10}
    href={SHITZU_FACE}
    clip-path="path('{svgPath}')"
    width="180"
    height="180"
    class="fill-lime {!(src && ready)
      ? 'opacity-100'
      : 'opacity-0'} transition duration-200 ease-in-out"
  />
</svg>
