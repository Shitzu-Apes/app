<script lang="ts">
  import MemePreview from "./Desktop/MemePreview.svelte";

  import type { Meme } from "$lib/api/client";

  export let king: Meme | undefined;
</script>

{#if king}
  <div class="max-w-lg">
    <MemePreview memebid={king} />
  </div>
{:else}
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
{/if}
