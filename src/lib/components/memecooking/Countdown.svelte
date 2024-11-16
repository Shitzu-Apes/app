<script lang="ts">
  import { onMount } from "svelte";

  export let to: number;
  export let format: "compact" | "full" = "full";
  let className: string = "";

  export { className as class };

  let started = false;
  let [days, hours, minutes, seconds] = [0, 0, 0, 0];

  function updateTime() {
    started = true;
    const now = Date.now();
    const diff = to - now;
    if (diff <= 0) {
      return false;
    }

    days = Math.floor(diff / (1000 * 60 * 60 * 24));
    hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return true;
  }

  onMount(() => {
    updateTime();
    const interval = setInterval(() => {
      if (!updateTime()) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  });

  function padZero(num: number) {
    return num.toString().padStart(2, "0");
  }
</script>

{#if format === "compact"}
  <div
    class="flex gap-2 justify-center items-start {className} {days > 0
      ? 'text-xs'
      : 'text-base'}"
  >
    {#if started}
      {#if days > 0}
        {days}d{padZero(hours)}h{padZero(minutes)}m
      {:else}
        {padZero(hours)}:{padZero(minutes)}:{padZero(seconds)}
      {/if}
    {:else}
      --:--:--
    {/if}
  </div>
{:else}
  <div class="flex gap-2 text-6xl justify-center items-start {className}">
    {#if days > 0}
      <div class="flex flex-col justify-center items-center flex-grow basis-0">
        <div>{days}</div>
        <div class="text-xs w-full text-center">
          {days > 1 ? "Days" : "Day"}
        </div>
      </div>
    {/if}
    <div class="flex flex-col justify-center items-center flex-grow basis-0">
      <div>
        {#if started}
          {hours}
        {:else}
          -
        {/if}
      </div>
      <div class="text-xs w-full text-center">
        {hours > 1 ? "Hours" : "Hour"}
      </div>
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
    {#if days === 0}
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
    {/if}
  </div>
{/if}
