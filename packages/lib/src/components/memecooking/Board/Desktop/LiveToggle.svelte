<script lang="ts">
  export let liveOnly = false;
</script>

<button
  class="flex items-center gap-2 px-3 py-1 h-fit rounded-full border border-gray-700 hover:border-gray-600 transition-colors"
  class:bg-gray-800={!liveOnly}
  class:bg-gray-700={liveOnly}
  on:click={() => (liveOnly = !liveOnly)}
>
  <div class="relative">
    <div
      class="absolute inset-0 rounded-full bg-memecooking-500 opacity-50 animate-ping"
      class:hidden={!liveOnly}
    ></div>
    <div
      class="size-3 rounded-full bg-memecooking-500"
      class:opacity-50={!liveOnly}
    ></div>
  </div>
  <span
    class="text-xs font-medium"
    class:text-gray-400={!liveOnly}
    class:text-white={liveOnly}>cooking</span
  >
</button>
