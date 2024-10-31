<script lang="ts">
  export let pathD: string;
  export let areaPathD: string;
  export let strokeWidth: number;
  export let color: string = "currentColor";
  export let areaOpacity: number = 0.2;
  export let strokeOpacity: number = 1;
  export let gradientId: string | undefined = undefined;
  let className: string | undefined = undefined;
  export { className as class };
</script>

<g class={className}>
  {#if pathD}
    {#if gradientId}
      <defs class={color}>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="currentColor" stop-opacity="0.6" />
          <stop offset="100%" stop-color="currentColor" stop-opacity="0.3" />
        </linearGradient>
      </defs>
    {/if}

    <!-- Area -->
    <path
      d={areaPathD}
      fill={gradientId ? `url(#${gradientId})` : color}
      fill-opacity={gradientId ? 1 : areaOpacity}
      class={color}
    />

    <!-- Line -->
    <path
      d={pathD}
      fill="none"
      stroke={color}
      stroke-width={strokeWidth}
      stroke-opacity={strokeOpacity}
    />
  {/if}
</g>
