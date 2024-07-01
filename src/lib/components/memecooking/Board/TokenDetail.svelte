<script lang="ts">
  import { onMount } from "svelte";

  // Random within 24 hours
  export let end = Date.now() + 1000 * 60 * 60 * 24 * Math.random();

  let [days, hours, minutes, seconds] = [0, 0, 0, 0];
  onMount(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = end - now;
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

<h2 class="flex text-2xl">
  <span class="text-shitzu-4">
    {#if days > 0}
      {days}d
    {/if}
    {#if hours > 0}
      {hours}h
    {/if}
    {#if minutes > 0}
      {minutes}m
    {/if}
    {#if seconds > 0}
      {seconds}s
    {/if}
  </span>
</h2>
<div class="flex gap-4 items-center">
  <div class="loader size-24" />
  <div class="flex flex-col gap-2">
    <!-- Created by -->
    <div class="loader w-40 h-4" />
    <!-- MCap -->
    <div class="loader w-50 h-4" />
    <!-- replies -->
    <div class="loader w-20 h-2" />
    <!-- Ticker -->
    <div class="loader w-50 h-5" />
  </div>
</div>
<div class="flex flex-col w-full px-4">
  <h3 class="flex">Bonding Curve</h3>
  <div class="loader w-full h-6"></div>
</div>
