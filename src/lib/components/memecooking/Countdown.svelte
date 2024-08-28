<script lang="ts">
  import { onMount } from "svelte";

  export let to: number;
  let className: string = "";

  export { className as class };

  let started = false;
  let [hours, minutes, seconds] = [0, 0, 0, 0];
  onMount(() => {
    const interval = setInterval(() => {
      started = true;
      const now = Date.now();
      const diff = to - now;
      if (diff <= 0) {
        clearInterval(interval);
        return;
      }

      hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      seconds = Math.floor((diff % (1000 * 60)) / 1000);
    }, 1000);

    return () => clearInterval(interval);
  });
</script>

<div class="flex gap-2 text-6xl justify-center items-start {className}">
  <div class="flex flex-col justify-center items-center flex-grow basis-0">
    <div>
      {#if started}
        {hours}
      {:else}
        -
      {/if}
    </div>
    <div class="text-xs w-full text-center">{hours > 1 ? "Hours" : "Hour"}</div>
  </div>
  <div class="flex flex-col justify-center items-center flex-grow basis-0">
    <div>
      {#if started}
        {minutes}
      {:else}
        -
      {/if}
    </div>
    <div class="text-xs w-full text-center">
      {minutes > 1 ? "Minutes" : "Minute"}
    </div>
  </div>
  <div class="flex flex-col justify-center items-center flex-grow basis-0">
    <div>
      {#if started}
        {seconds}
      {:else}
        -
      {/if}
    </div>
    <div class="text-xs w-full text-center">
      {seconds > 1 ? "Seconds" : "Second"}
    </div>
  </div>
</div>
