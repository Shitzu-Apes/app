<script lang="ts">
  export let progress: number;
</script>

<div class="mb-2">Staking progress: {(progress * 100).toFixed(2)}%</div>
<div
  class="w-full h-5 bg-gray-3 {progress > 0.5
    ? progress > 1
      ? 'text-shitzu-4'
      : 'text-amber-5'
    : 'text-red-5'} rounded-lg relative border-2 border-current"
>
  <div
    class="h-3 bg-current rounded-lg absolute top-0.5 left-0.5 transition-all duration-300 animate-ease-linear"
    style={`width: ${Math.min(progress, 1.2) * 100}%`}
  ></div>
  {#if progress > 1}
    <img
      src="/animations/explosion.gif"
      alt="Explosion"
      class="absolute top-0 right-0 transform translate-x-1/2 -translate-y-full w-30 aspect-[150/97] object-cover"
    />
    <img
      src="/animations/explosion.gif"
      alt="Explosion"
      class="absolute top-0 right-0 transform translate-x-1/2 w-30 aspect-[150/97] object-cover rotate-180"
    />
  {/if}
</div>
