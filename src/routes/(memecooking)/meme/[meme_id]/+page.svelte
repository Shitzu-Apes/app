<script lang="ts">
  import { onDestroy } from "svelte";
  import { get, writable } from "svelte/store";

  import MemeDetail from "./MemeDetail.svelte";

  import { page } from "$app/stores";
  import { client } from "$lib/api/client";
  import LoadingLambo from "$lib/components/memecooking/Board/LoadingLambo.svelte";
  import TokenDetailCarousel from "$lib/components/memecooking/Board/TokenDetailCarousel.svelte";
  import { getExternalMeme } from "$lib/external_memes";
  import { MemeCooking } from "$lib/near/memecooking";
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
    // First check if meme_id matches an external meme
    const externalMeme = await getExternalMeme(meme_id);
    if (externalMeme) {
      return { meme: externalMeme };
    }

    // Otherwise proceed with normal meme lookup
    const memebids = get(memebids$);
    const meme = memebids.find((memebids) => memebids.meme_id === +meme_id);
    const memebid = await MemeCooking.getMeme(Number(meme_id));

    if (meme) {
      // TODO fix API
      if (memebid) {
        meme.total_deposit = memebid.total_staked;
        meme.total_deposit_num = Number(memebid.total_staked);
        meme.end_timestamp_ms = Number(memebid.end_timestamp_ms);
      }
      return { meme };
    }

    const response = await client.GET("/meme/{id}", {
      params: {
        path: { id: meme_id },
      },
    });

    if (memebid && response.data) {
      response.data.meme.total_deposit = memebid.total_staked;
      response.data.meme.total_deposit_num = Number(memebid.total_staked);
      response.data.meme.end_timestamp_ms = Number(memebid.end_timestamp_ms);
    }
    return response.data;
  }, 20);
</script>

{#await meme}
  <div class="my-10">
    <LoadingLambo />
  </div>
{:then detail}
  {#if detail}
    <div class="desktop">
      <div class="w-full p-2 pb-25 w-full">
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
