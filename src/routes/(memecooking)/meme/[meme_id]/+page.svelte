<script lang="ts">
  import { onDestroy } from "svelte";
  import { get, writable, type Writable } from "svelte/store";

  import MemeDetail from "./MemeDetail.svelte";

  import { page } from "$app/stores";
  import { client } from "$lib/api/client";
  import LoadingLambo from "$lib/components/memecooking/Board/LoadingLambo.svelte";
  import TokenDetailCarousel from "$lib/components/memecooking/Board/TokenDetailCarousel.svelte";
  import { getExternalMeme } from "$lib/external_memes";
  import { ScreenSize } from "$lib/models";
  import type { Meme } from "$lib/models/memecooking/types";
  import { MemeCooking } from "$lib/near/memecooking";
  import { screenSize$ } from "$lib/screen-size";
  import { memebids$ } from "$lib/store/memebids";
  import { projectedPoolStats } from "$lib/util/projectedMCap";

  // page data
  $: meme_id = $page.params.meme_id;

  const memeStore: Writable<Meme | null> = writable(null);
  const loading = writable(true);
  const error = writable<Error | null>(null);

  let interval: number;
  function retryPromise<T>(
    fn: () => Promise<T>,
    retry: number = 10,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      fn().then(resolve).catch(reject);
      interval = setInterval(async () => {
        try {
          const result = await fn();
          retry--;
          if (result || retry === 0) {
            clearInterval(interval);
            resolve(result);
          }
        } catch (err) {
          clearInterval(interval);
          reject(err);
        }
      }, 1000) as unknown as number;
    });
  }

  onDestroy(() => {
    clearInterval(interval);
  });

  $: {
    loading.set(true);
    error.set(null);
    memeStore.set(null);

    retryPromise(async () => {
      try {
        // First check if meme_id matches an external meme
        const externalMeme = getExternalMeme(meme_id);
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
          response.data.meme.end_timestamp_ms = Number(
            memebid.end_timestamp_ms,
          );
        }

        return response.data;
      } catch (err) {
        error.set(err as Error);
        return null;
      } finally {
        loading.set(false);
      }
    }, 20).then((detail) => {
      if (detail) {
        memeStore.set({
          ...detail.meme,
          projectedPoolStats: projectedPoolStats(detail.meme),
        });
      }
    });
  }
</script>

{#if $loading}
  <div class="my-10">
    <LoadingLambo />
  </div>
{:else if $error}
  <div>Error: {$error.message}</div>
{:else if $memeStore}
  {#if $screenSize$ > ScreenSize.Tablet}
    <div class="w-full p-2 pb-25">
      <MemeDetail meme={$memeStore} />
    </div>
  {:else}
    <TokenDetailCarousel meme={$memeStore} />
  {/if}
{:else}
  <div>Meme not found</div>
{/if}
