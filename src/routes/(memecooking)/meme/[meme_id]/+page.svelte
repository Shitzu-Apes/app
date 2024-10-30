<script lang="ts">
  import { onDestroy } from "svelte";
  import { get, writable } from "svelte/store";

  import MemeDetail from "./MemeDetail.svelte";

  import { page } from "$app/stores";
  import { client } from "$lib/api/client";
  import LoadingLambo from "$lib/components/memecooking/Board/LoadingLambo.svelte";
  import TokenDetailCarousel from "$lib/components/memecooking/Board/TokenDetailCarousel.svelte";
  import { memebids$ } from "$lib/store/memebids";

  // page data
  $: meme_id = $page.params.meme_id;

  let interval: number;
  function retryPromise<T>(
    fn: () => Promise<T>,
    retry: number = 10,
  ): Promise<T> {
    return new Promise((resolve) => {
      fn().then(resolve);
      interval = setInterval(async () => {
        const result = await fn();
        retry--;
        if (result || retry === 0) {
          clearInterval(interval);
          resolve(result);
        }
      }, 1000) as unknown as number;
    });
  }

  onDestroy(() => {
    clearInterval(interval);
  });

  $: meme = retryPromise(async () => {
    const memebids = await get(memebids$);
    const meme = memebids.find((memebids) => memebids.meme_id === +meme_id);

    if (meme) {
      return { meme };
    }

    const response = await client.GET("/meme/{id}", {
      params: {
        path: { id: meme_id },
      },
    });

    return response.data;
  }, 20);
</script>

<div class="flex mb-5 sm:mb-0">
  <a
    href="/board"
    class="text-white flex items-center gap-1 hover:text-shitzu-3"
  >
    <div class="i-mdi:chevron-left size-8" />
    back
  </a>
</div>
{#await meme}
  <div class="my-10">
    <LoadingLambo />
  </div>
{:then detail}
  {#if detail}
    <div class="desktop">
      <div class="w-full p-2 pb-25 container mx-auto">
        <MemeDetail meme$={writable(detail.meme)} />
      </div>
    </div>
    <div class="mobile">
      <TokenDetailCarousel memebid$={writable(detail.meme)} />
    </div>
  {:else}
    <div>Meme not found</div>
  {/if}
{:catch error}
  <div>Error: {error.message}</div>
{/await}

<style lang="scss">
  .mobile {
    display: none;
  }
  .desktop {
    display: contents;
  }

  @include breakpoint(mobile, max) {
    .mobile {
      display: contents;
    }
    .desktop {
      display: none;
    }
  }
</style>
