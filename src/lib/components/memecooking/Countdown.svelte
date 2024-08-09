<script lang="ts">
  import { onMount } from "svelte";

  export let to: number;
  let className: string = "";

  export { className as class };

  let started = false;
  let [days, hours, minutes, seconds] = [0, 0, 0, 0];
  onMount(() => {
    const interval = setInterval(() => {
      started = true;
      const now = Date.now();
      const diff = to - now;
      if (diff <= 0) {
        clearInterval(interval);
        return;
      }

      days = Math.floor(diff / (1000 * 60 * 60 * 24));
      hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      seconds = Math.floor((diff % (1000 * 60)) / 1000);
    }, 1000);

    return () => clearInterval(interval);
  });
</script>

<span class={className}>
  {#if started}
    {#if days === 0 && hours === 0 && minutes === 0 && seconds === 0}
      0h 0m 0s
    {:else}
      {#if days > 0}
        {days}d
      {/if}
      {#if hours > 0 || days > 0}
        {hours}h
      {/if}
      {#if minutes > 0 || hours > 0 || days > 0}
        {minutes}m
      {/if}
      {#if seconds > 0 || minutes > 0 || hours > 0 || days > 0}
        {seconds}s
      {/if}
    {/if}
  {:else}
    <slot name="loading">Loading...</slot>
  {/if}
</span>
