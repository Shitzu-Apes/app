<script lang="ts">
  import { onMount } from "svelte";

  import SHITZU_POCKET from "$lib/assets/shitzu_pocket.svg";
  import type { MCMemeInfoWithReference } from "$lib/models/memecooking";
  import { FixedNumber } from "$lib/util";

  export let memebid: MCMemeInfoWithReference;

  let end = memebid.end_timestamp_ms;

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

<a
  href="/meme/{memebid.id}"
  class="flex items-start justify-start w-full max-w-sm gap-3 p-2 border border-transparent hover:border-white cursor-pointer"
>
  <img src={memebid.image} alt={memebid.name} class="w-24 h-24" />
  <div class="flex flex-col items-start justify-start h-full gap-1">
    <div class="text-xs flex items-center gap-1">
      created by <img src={SHITZU_POCKET} alt="shitzu pocket" class="size-4" />
      {memebid.owner}
    </div>
    <div class="text-sm">
      {memebid.name}
      <span class="font-bold text-shitzu-4">${memebid.symbol}</span>
    </div>
    <div class="text-xs">{memebid.description}</div>

    <div class="flex flex-col gap-1">
      <span class="text-xs text-shitzu-4">
        {#if days === 0 && hours === 0 && minutes === 0 && seconds === 0}
          Ended
        {:else}
          <!-- show d h m s (don't hide when m = 0 but h > 0) -->

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
      </span>
      <span class="text-xs bg-amber text-white px-2 rounded">
        {new FixedNumber(memebid.total_staked, 24).format()}
      </span>
    </div>
  </div></a
>
