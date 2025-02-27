<script lang="ts">
  import { onMount } from "svelte";
  import { derived, writable } from "svelte/store";

  import MemeDetailPage from "./MemeDetailPage.svelte";

  import { page } from "$app/stores";
  import { useMemeDetailQuery } from "$lib/api/queries/memes";
  import { getXCallbackParams } from "$lib/auth/x-callback";
  import { addToast } from "$lib/components/Toast.svelte";
  import { EXTERNAL_MEMES } from "$lib/external_memes";

  // Create a store for the meme ID to ensure reactivity
  const currentMemeId = writable<number | null>(null);

  // Update the meme ID whenever page params change
  $: {
    const meme = EXTERNAL_MEMES.find(
      (meme) => meme.token_id === $page.params.meme_id,
    );

    if (!meme) {
      console.log("[meme::+page] meme not found", $page.params.meme_id);
      currentMemeId.set(Number($page.params.meme_id));
    } else {
      currentMemeId.set(meme.meme_id);
    }
  }

  // Create the query based on the currentMemeId
  $: memeDetailQuery = derived(currentMemeId, (id) => {
    console.log("[meme::+page] querying meme id", id);
    return id !== null ? useMemeDetailQuery(id) : null;
  });

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

{#if $memeDetailQuery}
  <MemeDetailPage memeDetailQuery={$memeDetailQuery} />
{/if}
