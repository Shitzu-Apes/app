<script lang="ts">
  import { onDestroy } from "svelte";

  import MemeDetail from "./MemeDetail.svelte";

  import { page } from "$app/stores";
  import { client } from "$lib/api/client";
  import TokenDetailCarousel from "$lib/components/memecooking/Board/TokenDetailCarousel.svelte";
  import { requiredStake, wallet } from "$lib/near";

  // page data
  let { meme_id } = $page.params as { meme_id: string };

  const { accountId$ } = wallet;

  let interval: number;
  function retryPromise<T>(
    fn: () => Promise<T>,
    retry: number = 10,
  ): Promise<T> {
    return new Promise((resolve) => {
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

  let meme = retryPromise(
    () =>
      client
        .GET("/meme/{id}", {
          params: {
            query: {
              accountId: $accountId$,
            },
            path: { id: meme_id },
          },
        })
        .then((res) => {
          console.log("[meme]", res.data);
          return res.data;
        }),
    20,
  );
</script>

<div class="mt-10 w-full p-2">
  <div class="mx-auto flex">
    <a href="/board" class="text-white text-2xl mx-auto mb-10">[go back]</a>
  </div>
  {#await Promise.all([meme, requiredStake])}
    <div class="w-full text-center text-2xl">Loading...</div>
  {:then [detail, requiredStake]}
    {#if detail}
      <div class="desktop">
        <MemeDetail meme={detail.meme} {requiredStake} />
      </div>
      <div class="mobile">
        <TokenDetailCarousel
          focused={true}
          memebid={detail.meme}
          {requiredStake}
        />
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
