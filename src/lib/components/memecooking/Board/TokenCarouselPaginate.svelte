<script lang="ts">
  import { onMount } from "svelte";
  import { writable } from "svelte/store";

  import TokenDetailCarousel from "./TokenDetailCarousel.svelte";

  import type { Meme } from "$lib/models/memecooking";

  export let memebids: Meme[];

  let observer: IntersectionObserver | undefined;
  let page = 1;
  let perPage = 5;

  let sentinel: HTMLElement | undefined;
  onMount(() => {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            console.log("intersecting");
            page += 1;
          }
        });
      },
      { threshold: 0.1 },
    );

    if (sentinel) {
      console.log("observing sentinel");
      observer.observe(sentinel);
    }

    return () => {
      if (observer && sentinel) {
        observer.unobserve(sentinel);
      }
    };
  });
</script>

<div class="w-full max-w-lg mx-auto">
  <div class="relative focus-element">
    <div class="flex flex-col h-screen pb-20vh">
      {#each memebids.slice(0, page * perPage) as memebid (memebid.meme_id)}
        <div class="px-3 my-3">
          <div class="flex flex-col rounded-xl bg-dark-8 overflow-hidden">
            <TokenDetailCarousel memebid$={writable(memebid)} />
          </div>
        </div>
      {/each}
      <div bind:this={sentinel} class="h-1 pb-20vh mb-10vh w-full" />
    </div>
  </div>
</div>
