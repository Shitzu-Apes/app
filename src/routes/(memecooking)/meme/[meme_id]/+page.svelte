<script lang="ts">
  import { onDestroy } from "svelte";
  import { get, writable } from "svelte/store";

  import MemeDetail from "./MemeDetail.svelte";

  import { page } from "$app/stores";
  import { client } from "$lib/api/client";
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

<div class="w-full p-2 pb-25">
  <div class="mx-auto flex mb-5">
    <a href="/board" class="text-white text-2xl mx-auto hover:font-bold"
      >[go back]</a
    >
  </div>
  {#await meme}
    <div class="w-full text-center text-2xl">Loading...</div>
  {:then detail}
    {#if detail}
      <div class="desktop">
        <MemeDetail meme$={writable(detail.meme)} />
      </div>
      <div class="mobile">
        <TokenDetailCarousel focused={true} memebid$={writable(detail.meme)} />
      </div>
    {:else}
      <div>Meme not found</div>
    {/if}
  {:catch error}
    <div>Error: {error.message}</div>
  {/await}
</div>

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
