<script lang="ts">
  import { onMount } from "svelte";
  import { derived } from "svelte/store";

  import MemeDetail from "./MemeDetail.svelte";

  import { page } from "$app/stores";
  import { createMemeDetailQuery } from "$lib/api/queries/memes";
  import { getXCallbackParams } from "$lib/auth/x-callback";
  import { addToast } from "$lib/components/Toast.svelte";
  import LoadingLambo from "$lib/components/memecooking/Board/LoadingLambo.svelte";
  import TokenDetailCarousel from "$lib/components/memecooking/Board/TokenDetailCarousel.svelte";
  import { ScreenSize } from "$lib/models";
  import { screenSize$ } from "$lib/screen-size";

  const memeDetailQuery = createMemeDetailQuery(
    derived(page, (page) => Number(page.params.meme_id)),
  );
  // const loading = writable(true);
  // const memeStore = derived([page, memeMap$], ([page, memeMap]) => {
  //   console.log("[meme::+page] memeMap", memeMap);
  //   loading.set(true);
  //   const externalMeme = getExternalMeme(page.params.meme_id);
  //   if (externalMeme) {
  //     loading.set(false);
  //     console.log("[meme::+page] externalMeme", externalMeme);
  //     return externalMeme;
  //   }
  //   const meme = memeMap.get(Number(page.params.meme_id));
  //   if (meme) {
  //     loading.set(false);
  //     return meme;
  //   }

  //   console.log("[meme::+page] getMeme", Number(page.params.meme_id));
  //   getMeme(Number(page.params.meme_id));

  //   return null;
  // });
  // const error = writable<Error | null>(null);
  // let interval: number;
  // function retryPromise<T>(
  //   fn: () => Promise<T>,
  //   retry: number = 10,
  // ): Promise<T> {
  //   return new Promise((resolve, reject) => {
  //     fn().then(resolve).catch(reject);
  //     interval = setInterval(async () => {
  //       try {
  //         const result = await fn();
  //         retry--;
  //         if (result || retry === 0) {
  //           clearInterval(interval);
  //           resolve(result);
  //         }
  //       } catch (err) {
  //         clearInterval(interval);
  //         reject(err);
  //       }
  //     }, 1000) as unknown as number;
  //   });
  // }

  onMount(() => {
    const url = new URL(window.location.href);
    const params = getXCallbackParams(url);

    if (!params) {
      return;
    }

    const { status, message } = params;
    // remove params from url
    url.searchParams.delete("status");
    url.searchParams.delete("message");
    window.history.replaceState({}, document.title, url.toString());

    addToast({
      data: {
        type: "simple",
        data: {
          title:
            "Twitter Verification " +
            (status === "error" ? "Error" : "Success"),
          description: message,
          type: status === "error" ? "error" : "success",
        },
      },
    });
  });
</script>

{#if $memeDetailQuery.isLoading}
  <div class="my-10">
    <LoadingLambo />
  </div>
{:else if $memeDetailQuery.isError}
  <div>Error: {$memeDetailQuery.error.message}</div>
{:else if $memeDetailQuery.data?.meme}
  {#if $screenSize$ > ScreenSize.Tablet}
    <div class="w-full p-2 pb-25">
      <MemeDetail meme={$memeDetailQuery.data.meme} />
    </div>
  {:else}
    <TokenDetailCarousel meme={$memeDetailQuery.data.meme} />
  {/if}
{:else}
  <div>Meme not found</div>
{/if}
