<script lang="ts">
  import { onDestroy } from "svelte";
  import { derived, writable } from "svelte/store";

  import MemeDetail from "./MemeDetail.svelte";

  import { page } from "$app/stores";
  import LoadingLambo from "$lib/components/memecooking/Board/LoadingLambo.svelte";
  import TokenDetailCarousel from "$lib/components/memecooking/Board/TokenDetailCarousel.svelte";
  import { getExternalMeme } from "$lib/external_memes";
  import { ScreenSize } from "$lib/models";
  import { screenSize$ } from "$lib/screen-size";
  import { getMeme, memeMap$ } from "$lib/store/memebids";

  const loading = writable(true);
  const memeStore = derived([page, memeMap$], ([page, memeMap]) => {
    loading.set(true);
    const externalMeme = getExternalMeme(page.params.meme_id);
    if (externalMeme) {
      return externalMeme;
    }
    const meme = memeMap.get(Number(page.params.meme_id));
    loading.set(false);
    if (meme) {
      return meme;
    }

    getMeme(Number(page.params.meme_id));

    return null;
  });
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
    if ($memeStore === undefined) {
      loading.set(true);
      error.set(null);

      retryPromise(async () => {
        try {
          loading.set(true);
          return await getMeme(Number($page.params.meme_id));
        } catch (err) {
          error.set(err as Error);
          return null;
        } finally {
          loading.set(false);
        }
      }, 20);
    }
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
